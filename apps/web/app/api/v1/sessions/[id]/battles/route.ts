import { errorResponse, enforceRateLimit, parseDelay } from '@/lib/server/http';
import { getRequestRuntime } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceRateLimit(request);
    const { id } = await params;
    const searchParams = new URL(request.url).searchParams;
    const runtime = await getRequestRuntime(request);
    const snapshot = await runtime.engine.getSnapshot(id, {
      delaySeconds: parseDelay(searchParams),
      favoriteDriverId: searchParams.get('favorite')
    });
    return Response.json(snapshot.battles);
  } catch (error) {
    return errorResponse(error);
  }
}
