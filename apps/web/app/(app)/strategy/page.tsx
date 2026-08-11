import { StrategyMode } from '@/components/strategy/strategy-mode';
import { getServerRuntime } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';

export default async function StrategyPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const params = await searchParams;
  const runtime = await getServerRuntime();
  const session = runtime.meeting.sessions.find((candidate) => candidate.kind === 'race') ?? runtime.meeting.sessions.find((candidate) => candidate.kind === 'sprint') ?? runtime.meeting.sessions[0];
  if (!session) return <main className="center-state"><h1>Strategy unavailable</h1><p>No session was supplied for this weekend.</p></main>;
  const snapshot = await runtime.engine.getSnapshot(session.id, { delaySeconds: 0, favoriteDriverId: params.a ?? null });
  return <StrategyMode meeting={runtime.meeting} initialSnapshot={snapshot} requestedPrimaryId={params.a ?? null} requestedRivalId={params.b ?? null} />;
}
