'use client';

import type { Meeting, SessionSnapshot } from '@f1/domain';
import { useLiveSession } from '@/lib/client/use-live-session';
import { formatCompound, formatGap, formatLapTime } from '@/lib/format';
import { BottomNav } from '@/components/shared/bottom-nav';
import { usePreferences } from '@/lib/client/preferences';

export function SessionTableMode({ meeting, initialSnapshot }: { meeting: Meeting; initialSnapshot: SessionSnapshot }) {
  const favoriteDriverId = usePreferences((state) => state.favoriteDriverId);
  const { data: snapshot } = useLiveSession(initialSnapshot.id, initialSnapshot);
  const qualifying = snapshot.kind === 'qualifying';
  const cutoff = snapshot.segment === 'Q1' ? 15 : 10;
  return (
    <div className="app-shell">
      <main className="page-frame session-mode">
        <p className="eyebrow">{meeting.name}</p>
        <header><h1>{qualifying ? `Qualifying · ${snapshot.segment ?? 'Q1'}` : 'Practice'}</h1><strong>{snapshot.clockSeconds === null ? 'LIVE' : formatClock(snapshot.clockSeconds)}</strong></header>
        <table className="leaderboard">
          <thead><tr><th>Pos</th><th>Driver</th><th>{qualifying ? 'Best' : 'Best / last'}</th><th>Gap</th><th>Tyre</th><th>Pace 5</th></tr></thead>
          <tbody>{snapshot.drivers.map((driver) => (
            <tr key={driver.driverId} className={qualifying && driver.position === cutoff ? 'cutoff-row' : undefined}>
              <td>{driver.position ?? '—'}</td><th>{driver.code}{qualifying && driver.position === cutoff ? <small> CUTOFF</small> : null}</th>
              <td>{formatLapTime(driver.bestLapSec)}{qualifying ? null : <small> / {formatLapTime(driver.lastLapSec)}</small>}</td>
              <td>{formatGap(driver.gapToLeaderSec, driver.position === 1)}</td><td>{formatCompound(driver.currentStint?.compound ?? null)} · {driver.currentStint?.currentAgeLaps ?? '—'}</td><td>{formatLapTime(driver.pace5Sec)}</td>
            </tr>
          ))}</tbody>
        </table>
        <p className="method-note">{qualifying ? 'Cutoff margin uses last classified time. No opaque prediction.' : 'Long-run pace appears after five consecutive clean laps. Trends are estimates.'}</p>
      </main>
      <BottomNav favoriteDriverId={favoriteDriverId} />
    </div>
  );
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}
