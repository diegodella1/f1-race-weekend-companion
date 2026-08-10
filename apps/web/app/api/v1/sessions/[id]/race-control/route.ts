import { errorResponse, enforceRateLimit, parseDelay } from '@/lib/server/http';
import { getRequestRuntime } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceRateLimit(request);
    const { id } = await params;
    const searchParams = new URL(request.url).searchParams;
    const cursor = Math.max(0, Number(searchParams.get('cursor') ?? 0));
    const runtime = await getRequestRuntime(request);
    const snapshot = await runtime.engine.getSnapshot(id, {
      delaySeconds: parseDelay(searchParams),
      favoriteDriverId: null
    });
    const events = snapshot.raceControl.slice(cursor, cursor + 25);
    return Response.json({ events, nextCursor: cursor + events.length < snapshot.raceControl.length ? cursor + events.length : null });
  } catch (error) {
    return errorResponse(error);
  }
}
