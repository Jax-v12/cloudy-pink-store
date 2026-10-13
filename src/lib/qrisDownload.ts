export type QrisImageExt = 'png' | 'jpg';

export function sanitizeQrisInvoice(invoice: string): string {
  return invoice.replace(/[^A-Za-z0-9_-]/g, '') || 'INVOICE';
}

function normalizeMime(mime: string | null | undefined): string {
  return (mime ?? '').toLowerCase().split(';')[0].trim();
}

export function qrisExtensionForBlobMime(blobType: string | null | undefined): QrisImageExt | null {
  const mime = normalizeMime(blobType);
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  return null;
}

export function qrisExtensionForDataUrl(dataUrl: string): QrisImageExt | null {
  if (!dataUrl.startsWith('data:')) return null;
  const match = /^data:([^;,]+)/i.exec(dataUrl);
  if (!match) return null;
  return qrisExtensionForBlobMime(match[1]);
}

export function qrisDownloadFilename(invoice: string, ext: QrisImageExt): string {
  return `QRIS-${sanitizeQrisInvoice(invoice)}.${ext}`;
}
