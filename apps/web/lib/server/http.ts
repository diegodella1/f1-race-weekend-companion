import { NextResponse } from 'next/server';
import { ProviderError } from '@f1/providers';

const allowedDelays = new Set([0, 10, 20, 30, 45, 60]);

export function parseDelay(searchParams: URLSearchParams): number {
  const value = Number(searchParams.get('delay') ?? 0);
  if (!allowedDelays.has(value)) throw new HttpError('INVALID_DELAY', 'Delay must be 0, 10, 20, 30, 45, or 60', false, 400);
  return value;
}

export class HttpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly status: number
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function errorResponse(error: unknown): NextResponse {
  const requestId = crypto.randomUUID();
  if (error instanceof HttpError) {
    return NextResponse.json({ code: error.code, message: error.message, retryable: error.retryable, requestId }, { status: error.status });
  }
  if (error instanceof ProviderError) {
    return NextResponse.json(
      { code: error.code, message: error.message, retryable: error.retryable, requestId },
      { status: error.status ?? 503 }
    );
  }
  console.error(`[${requestId}] Unhandled API error`, error instanceof Error ? error.message : 'Unknown error');
  return NextResponse.json(
    { code: 'INTERNAL_ERROR', message: 'The session service could not complete this request', retryable: true, requestId },
    { status: 500 }
  );
}

const requestBuckets = new Map<string, { count: number; resetsAt: number }>();

export function enforceRateLimit(request: Request, maximum = 120): void {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const key = forwarded || 'local';
  const now = Date.now();
  const bucket = requestBuckets.get(key);
  if (!bucket || bucket.resetsAt <= now) {
    requestBuckets.set(key, { count: 1, resetsAt: now + 60_000 });
    return;
  }
  bucket.count += 1;
  if (bucket.count > maximum) throw new HttpError('RATE_LIMITED', 'Too many requests', true, 429);
}
