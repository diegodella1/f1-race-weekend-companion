import { errorResponse, enforceRateLimit, HttpError } from '@/lib/server/http';
import { getRequestRuntime } from '@/lib/server/runtime';

export async function GET(request: Request, { params }: { params: Promise<{ trackId: string }> }) {
  try {
    enforceRateLimit(request);
    const { trackId } = await params;
    const runtime = await getRequestRuntime(request);
    if (runtime.track.id !== trackId) throw new HttpError('TRACK_NOT_FOUND', 'Track not found', false, 404);
    return Response.json(runtime.track);
  } catch (error) {
    return errorResponse(error);
  }
}
