import { errorResponse, enforceRateLimit, parseDelay } from '@/lib/server/http';
import { getRequestRuntime } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceRateLimit(request);
    const { id } = await params;
    const runtime = await getRequestRuntime(request);
    const delaySeconds = parseDelay(new URL(request.url).searchParams);
    const snapshot = await runtime.engine.getSnapshot(id, { delaySeconds, favoriteDriverId: null });
    return Response.json({
      id: snapshot.id,
      meetingId: snapshot.meetingId,
      kind: snapshot.kind,
      phase: snapshot.phase,
      segment: snapshot.segment,
      startedAt: snapshot.startedAt,
      endsAt: snapshot.endsAt,
      capabilities: runtime.engine.capabilities(),
      meta: snapshot.meta
    });
  } catch (error) {
    return errorResponse(error);
  }
}
