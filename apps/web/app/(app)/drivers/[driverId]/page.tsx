import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metric, Surface } from '@f1/ui';
import { getServerRuntime } from '@/lib/server/runtime';
import { formatCompound, formatGap, formatLapTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DriverPage({ params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = await params;
  const runtime = await getServerRuntime();
  const session = runtime.meeting.sessions.find((candidate) => candidate.kind === 'race');
  if (!session) notFound();
  const snapshot = await runtime.engine.getSnapshot(session.id, { delaySeconds: 0, favoriteDriverId: driverId });
  const driver = snapshot.drivers.find((candidate) => candidate.driverId === driverId);
  if (!driver) notFound();
  const rival = snapshot.drivers.find((candidate) => candidate.position === (driver.position ?? 0) - 1) ?? snapshot.drivers.find((candidate) => candidate.position === (driver.position ?? 0) + 1);
  return (
    <main className="page-frame driver-detail">
      <Link className="back-link" href="/weekend">← Live timing</Link>
      <header style={{ '--team-color': driver.teamColor ?? '#9BA3AF' } as React.CSSProperties}><p className="eyebrow">P{driver.position ?? '—'} · {driver.teamName}</p><h1>{driver.code}</h1><span>{driver.fullName}</span></header>
      <div className="metric-grid"><Metric label="Interval" value={formatGap(driver.intervalAheadSec, driver.position === 1)}/><Metric label="Tyre" value={`${formatCompound(driver.currentStint?.compound ?? null)} · ${driver.currentStint?.currentAgeLaps ?? '—'}`}/><Metric label="Last" value={formatLapTime(driver.lastLapSec)}/><Metric label="Pace 5" value={formatLapTime(driver.pace5Sec)} detail="clean laps"/></div>
      <Surface className="stint-history"><div className="panel-heading"><h2>Stints</h2></div><div>{driver.stints.map((stint) => <span key={stint.index} className={`stint stint--${stint.compound?.toLowerCase() ?? 'unknown'}`} style={{ flex: Math.max(1, (stint.endLap ?? snapshot.lap ?? stint.startLap) - stint.startLap + 1) }}>{stint.compound ?? 'UNKNOWN'} <small>L{stint.startLap}–{stint.endLap ?? 'NOW'}</small></span>)}</div></Surface>
      <Surface><div className="panel-heading"><h2>Recent laps</h2><span>clean only</span></div><ol className="lap-history">{driver.laps.slice(-12).reverse().map((lap) => <li key={lap.lapNumber} className={lap.clean ? undefined : 'excluded'}><b>L{lap.lapNumber}</b><span>{formatLapTime(lap.timeSec)}</span><small>{lap.clean ? lap.sectorsSec.map(formatLapTime).join(' / ') : lap.exclusionReasons.join(', ')}</small></li>)}</ol></Surface>
      {rival ? <Link className="primary-action" href={`/compare?session=${encodeURIComponent(session.id)}&a=${encodeURIComponent(driver.driverId)}&b=${encodeURIComponent(rival.driverId)}`}>Compare with {rival.code}</Link> : null}
    </main>
  );
}
