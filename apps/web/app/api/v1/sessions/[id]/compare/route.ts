import { errorResponse, enforceRateLimit, HttpError, parseDelay } from '@/lib/server/http';
import { getRequestRuntime } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceRateLimit(request);
    const { id } = await params;
    const searchParams = new URL(request.url).searchParams;
    const a = searchParams.get('a');
    const b = searchParams.get('b');
    if (!a || !b || a === b) throw new HttpError('INVALID_COMPARISON', 'Select two different drivers', false, 400);
    const runtime = await getRequestRuntime(request);
    const [driverA, driverB] = await runtime.engine.compare(id, [a, b], {
      delaySeconds: parseDelay(searchParams),
      favoriteDriverId: a
    });
    if (!driverA || !driverB) throw new HttpError('DRIVER_NOT_FOUND', 'A selected driver is unavailable', false, 404);
    return Response.json({ a: driverA, b: driverB });
  } catch (error) {
    return errorResponse(error);
  }
}
