import type { DataHealth, SessionSnapshot } from '@f1/domain';

export function DataStateBanner({ snapshot, health, streamConnected }: {
  snapshot: SessionSnapshot;
  health: DataHealth | null;
  streamConnected: boolean;
}) {
  const state = health?.state ?? (snapshot.meta.stale ? 'stale' : 'fresh');
  if (state === 'fresh' && streamConnected) return null;
  const message = state === 'rate_limited'
    ? 'Provider is limiting updates · showing cached data'
    : state === 'offline'
      ? 'Offline · showing last snapshot'
      : snapshot.meta.stale
        ? `Data delayed · ${Math.round(snapshot.meta.ageSeconds)}s`
        : 'Polling fallback active';
  return <div className="data-banner" role="status">{message}</div>;
}
