import { errorResponse, enforceRateLimit, HttpError, parseDelay } from '@/lib/server/http';
import { getRequestRuntime } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; driverId: string }> }
) {
  try {
    enforceRateLimit(request);
    const { id, driverId } = await params;
    const runtime = await getRequestRuntime(request);
    const driver = await runtime.engine.getDriver(id, driverId, {
      delaySeconds: parseDelay(new URL(request.url).searchParams),
      favoriteDriverId: null
    });
    if (!driver) throw new HttpError('DRIVER_NOT_FOUND', 'Driver not found in this session', false, 404);
    return Response.json(driver);
  } catch (error) {
    return errorResponse(error);
  }
}
