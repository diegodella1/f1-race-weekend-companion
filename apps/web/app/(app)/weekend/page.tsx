import { WeekendMode } from '@/components/modes/weekend-mode';
import { getServerRuntime } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';

export default async function WeekendPage() {
  const runtime = await getServerRuntime();
  const session = runtime.meeting.sessions.find((candidate) => candidate.kind === 'race') ?? runtime.meeting.sessions[0];
  if (!session) return <main className="center-state"><h1>No race weekend found</h1><p>Live data starts near session time.</p></main>;
  const snapshot = await runtime.engine.getSnapshot(session.id, { delaySeconds: 0, favoriteDriverId: null });
  return <WeekendMode meeting={runtime.meeting} snapshot={snapshot} />;
}
