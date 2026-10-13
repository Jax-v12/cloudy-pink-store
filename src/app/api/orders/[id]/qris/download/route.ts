import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logFailure, privateHeaders } from '@/lib/http';
import { isValidOrderQrUrl } from '@/lib/midtrans';
import { consumeRateLimit } from '@/lib/rateLimit';
import QRCode from 'qrcode';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const MIN_IMAGE_BYTES = 50;

export const QRIS_DOWNLOAD_RATE_SCOPE = 'qris-download';
export const QRIS_DOWNLOAD_RATE_LIMIT = 10;
export const QRIS_DOWNLOAD_RATE_WINDOW_MS = 60_000;
const QRIS_DOWNLOAD_RETRY_AFTER_SECONDS = String(QRIS_DOWNLOAD_RATE_WINDOW_MS / 1000);

interface OrderDbClient {
  order: {
    findFirst: typeof prisma.order.findFirst;
  };
}

interface QrisDownloadDeps {
  limiter?: (scope: string, key: string, limit: number, windowMs: number) => Promise<boolean>;
  fetchFn?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
}

export async function handleQrisDownload(
  req: Request,
  id: string,
  dbClient?: OrderDbClient,
  deps?: QrisDownloadDeps
): Promise<Response> {
  try {
    const token = req.headers.get('x-order-token');
    if (!token || token.length > 128 || !id || id.length > 191) {
      return NextResponse.json({ success: false, errorCode: 'ORDER_NOT_FOUND' }, { status: 404, headers: privateHeaders });
    }

    const client = dbClient ?? prisma;
    const order = await client.order.findFirst({
      where: { invoice: id, accessToken: token },
      select: { id: true, invoice: true, status: true, qrisUrl: true },
    });

    if (!order) {
      return NextResponse.json({ success: false, errorCode: 'ORDER_NOT_FOUND' }, { status: 404, headers: privateHeaders });
    }

    if (order.status !== 'PENDING' || !order.qrisUrl) {
      return NextResponse.json({ success: false, errorCode: 'QRIS_NOT_AVAILABLE' }, { status: 400, headers: privateHeaders });
    }

    // Authenticated per-invoice rate limit, checked after auth so invoice
    // existence is never leaked, and before any QR work or upstream fetch.
    const limiter = deps?.limiter ?? consumeRateLimit;
    let allowed: boolean;
    try {
      allowed = await limiter(QRIS_DOWNLOAD_RATE_SCOPE, order.invoice, QRIS_DOWNLOAD_RATE_LIMIT, QRIS_DOWNLOAD_RATE_WINDOW_MS);
    } catch (error) {
      logFailure('QRIS download rate limit failed', error);
      return NextResponse.json({ success: false, errorCode: 'SYSTEM_ERROR' }, { status: 500, headers: privateHeaders });
    }
    if (!allowed) {
      return NextResponse.json(
        { success: false, errorCode: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: { ...privateHeaders, 'Retry-After': QRIS_DOWNLOAD_RETRY_AFTER_SECONDS } }
      );
    }

    const doFetch = deps?.fetchFn ?? globalThis.fetch;

    const safeInvoice = order.invoice.replace(/[^A-Za-z0-9_-]/g, '') || 'INVOICE';

    // Direct QR string (000201...) generated on the fly as PNG buffer
    if (order.qrisUrl.startsWith('000201') && order.qrisUrl.length <= 3000) {
      const pngBuffer = await QRCode.toBuffer(order.qrisUrl, {
        type: 'png',
        width: 600,
        errorCorrectionLevel: 'L',
      });
      return new Response(new Uint8Array(pngBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="QRIS-${safeInvoice}.png"`,
          ...privateHeaders,
        },
      });
    }

    // Official Midtrans QRIS URL verification
    if (!isValidOrderQrUrl(order.qrisUrl)) {
      return NextResponse.json({ success: false, errorCode: 'INVALID_QR_URL' }, { status: 400, headers: privateHeaders });
    }

    // Secure server-side fetch preventing CORS issues, SSRF, redirects, and oversize payloads
    let upstream: Response;
    try {
      upstream = await doFetch(order.qrisUrl, {
        method: 'GET',
        headers: { Accept: 'image/png,image/jpeg' },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      return NextResponse.json({ success: false, errorCode: 'UPSTREAM_FETCH_FAILED' }, { status: 502, headers: privateHeaders });
    }

    if (!upstream.ok) {
      return NextResponse.json({ success: false, errorCode: 'UPSTREAM_FETCH_FAILED' }, { status: 502, headers: privateHeaders });
    }

    // Validate Content-Type: strictly accept image/png or image/jpeg
    const rawContentType = upstream.headers.get('content-type')?.toLowerCase() || '';
    const mime = rawContentType.split(';')[0].trim();
    if (mime !== 'image/png' && mime !== 'image/jpeg') {
      return NextResponse.json({ success: false, errorCode: 'INVALID_QR_MIME' }, { status: 502, headers: privateHeaders });
    }

    // Check Content-Length upfront if declared
    const contentLengthHeader = upstream.headers.get('content-length');
    if (contentLengthHeader !== null) {
      const cl = Number(contentLengthHeader);
      if (Number.isFinite(cl) && cl > MAX_IMAGE_BYTES) {
        return NextResponse.json({ success: false, errorCode: 'RESPONSE_TOO_LARGE' }, { status: 502, headers: privateHeaders });
      }
    }

    // Stream reader bounded to MAX_IMAGE_BYTES (2 MB) to prevent unbounded buffering
    const reader = upstream.body?.getReader();
    if (!reader) {
      return NextResponse.json({ success: false, errorCode: 'UPSTREAM_FETCH_FAILED' }, { status: 502, headers: privateHeaders });
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    let exceeded = false;
    let streamFailed = false;

    try {
      while (true) {
        let readResult: Awaited<ReturnType<typeof reader.read>>;
        try {
          readResult = await reader.read();
        } catch {
          streamFailed = true;
          try {
            await reader.cancel();
          } catch {
            // Ignore stream cancellation error
          }
          break;
        }

        const { done, value } = readResult;
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > MAX_IMAGE_BYTES) {
            exceeded = true;
            try {
              await reader.cancel();
            } catch {
              // Ignore stream cancellation error
            }
            break;
          }
          chunks.push(value);
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Ignore lock release error
      }
    }

    if (streamFailed) {
      return NextResponse.json({ success: false, errorCode: 'UPSTREAM_FETCH_FAILED' }, { status: 502, headers: privateHeaders });
    }

    if (exceeded) {
      return NextResponse.json({ success: false, errorCode: 'RESPONSE_TOO_LARGE' }, { status: 502, headers: privateHeaders });
    }

    if (totalBytes < MIN_IMAGE_BYTES) {
      return NextResponse.json({ success: false, errorCode: 'INVALID_IMAGE_DATA' }, { status: 502, headers: privateHeaders });
    }

    const imageBuffer = Buffer.concat(chunks);

    // Validate magic bytes consistently against the claimed MIME type
    const isPng = imageBuffer.length >= 8 &&
      imageBuffer[0] === 0x89 &&
      imageBuffer[1] === 0x50 &&
      imageBuffer[2] === 0x4e &&
      imageBuffer[3] === 0x47 &&
      imageBuffer[4] === 0x0d &&
      imageBuffer[5] === 0x0a &&
      imageBuffer[6] === 0x1a &&
      imageBuffer[7] === 0x0a;

    const isJpg = imageBuffer.length >= 3 &&
      imageBuffer[0] === 0xff &&
      imageBuffer[1] === 0xd8 &&
      imageBuffer[2] === 0xff;

    let ext: 'png' | 'jpg' | null = null;
    let responseMime: 'image/png' | 'image/jpeg' | null = null;

    if (mime === 'image/png' && isPng) {
      ext = 'png';
      responseMime = 'image/png';
    } else if (mime === 'image/jpeg' && isJpg) {
      ext = 'jpg';
      responseMime = 'image/jpeg';
    }

    if (!ext || !responseMime) {
      return NextResponse.json({ success: false, errorCode: 'INVALID_IMAGE_DATA' }, { status: 502, headers: privateHeaders });
    }

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': responseMime,
        'Content-Disposition': `attachment; filename="QRIS-${safeInvoice}.${ext}"`,
        ...privateHeaders,
      },
    });
  } catch (error) {
    logFailure('QRIS download failed', error);
    return NextResponse.json({ success: false, errorCode: 'SYSTEM_ERROR' }, { status: 500, headers: privateHeaders });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleQrisDownload(req, id);
}
