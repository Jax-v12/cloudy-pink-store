import { NextResponse } from 'next/server';
import { CommerceError } from './commerce';
import { InputError, logFailure, privateHeaders } from './http';

export function apiError(error: unknown) {
  if (error instanceof CommerceError) return NextResponse.json({ success: false, errorCode: error.code }, { status: error.status, headers: privateHeaders });
  if (error instanceof InputError) return NextResponse.json({ success: false, errorCode: 'INVALID_INPUT' }, { status: error.status, headers: privateHeaders });
  logFailure('Commerce operation failed', error);
  return NextResponse.json({ success: false, errorCode: 'SYSTEM_ERROR' }, { status: 500, headers: privateHeaders });
}
