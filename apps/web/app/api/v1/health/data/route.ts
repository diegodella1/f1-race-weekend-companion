import { getRequestRuntime } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const runtime = await getRequestRuntime(request);
  if (runtime.engine.getHealth().lastSuccessAt === null) {
    const session = runtime.meeting.sessions.find((candidate) => candidate.kind === 'race') ?? runtime.meeting.sessions[0];
    if (session) {
      try {
        await runtime.engine.getSnapshot(session.id, { delaySeconds: 0, favoriteDriverId: null });
      } catch {
        // The engine records provider failures; health remains readable during outages.
      }
    }
  }
  return Response.json(runtime.engine.getHealth());
}
