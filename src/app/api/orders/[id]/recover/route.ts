import { NextResponse } from 'next/server';
import { privateHeaders } from '@/lib/http';

// An email address is not proof of mailbox ownership. A future recovery flow
// must deliver a single-use challenge through a verified channel.
export async function POST() {
  return NextResponse.json(
    { success: false, errorCode: 'RECOVERY_UNAVAILABLE' },
    { status: 410, headers: privateHeaders }
  );
}
