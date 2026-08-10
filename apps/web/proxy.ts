import { NextResponse, type NextRequest } from 'next/server';

const cookieName = 'f1c_replay_run';
const validRunId = /^[a-f0-9-]{36}$/u;

export function proxy(request: NextRequest) {
  const existing = request.cookies.get(cookieName)?.value;
  if (existing && validRunId.test(existing)) return NextResponse.next();
  const runId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  const cookies = requestHeaders.get('cookie');
  requestHeaders.set('cookie', `${cookies ? `${cookies}; ` : ''}${cookieName}=${runId}`);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(cookieName, runId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 2 * 60 * 60,
    path: '/'
  });
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icons/|tracks/|sw.js).*)']
};
