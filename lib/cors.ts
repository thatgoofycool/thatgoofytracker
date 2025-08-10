import { NextRequest, NextResponse } from 'next/server';

const allowedOrigins = [process.env.NEXT_PUBLIC_APP_URL || ''];

export function corsHeaders(origin?: string) {
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function preflight(req: NextRequest): NextResponse {
  const origin = req.headers.get('origin') || undefined;
  const headers = corsHeaders(origin);
  return new NextResponse(null, { status: 204, headers });
}


