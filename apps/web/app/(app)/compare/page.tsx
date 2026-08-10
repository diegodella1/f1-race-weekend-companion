import Link from 'next/link';
import { Metric } from '@f1/ui';
import { LapChart } from '@/components/driver/lap-chart';
import { getServerRuntime } from '@/lib/server/runtime';
import { formatCompound, formatGap, formatLapTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ session?: string; a?: string; b?: string }> }) {
  const params = await searchParams;
  const runtime = await getServerRuntime();
  const sessionId = params.session ?? runtime.meeting.sessions.find((session) => session.kind === 'race')?.id ?? '';
  const snapshot = await runtime.engine.getSnapshot(sessionId, { delaySeconds: 0, favoriteDriverId: params.a ?? null });
  const driverA = snapshot.drivers.find((driver) => driver.driverId === params.a) ?? snapshot.drivers[0];
  const driverB = snapshot.drivers.find((driver) => driver.driverId === params.b) ?? snapshot.drivers[1];
  if (!driverA || !driverB) return <main className="center-state"><h1>Comparison unavailable</h1></main>;
  return (
    <main className="page-frame compare-page">
      <Link className="back-link" href="/weekend">← Live timing</Link><p className="eyebrow">DRIVER COMPARE</p><h1>{driverA.code} <span>vs</span> {driverB.code}</h1>
      <form className="compare-selectors"><input type="hidden" name="session" value={sessionId}/><select name="a" defaultValue={driverA.driverId}>{snapshot.drivers.map((driver) => <option value={driver.driverId} key={driver.driverId}>{driver.code} · {driver.fullName}</option>)}</select><span>↔</span><select name="b" defaultValue={driverB.driverId}>{snapshot.drivers.map((driver) => <option value={driver.driverId} key={driver.driverId}>{driver.code} · {driver.fullName}</option>)}</select><button type="submit">Compare</button></form>
      <div className="comparison-grid"><DriverMetrics driver={driverA}/><DriverMetrics driver={driverB}/></div>
      <section className="surface chart-surface"><div className="panel-heading"><div><p className="eyebrow">PACE TRACE</p><h2>Clean lap time</h2></div></div><LapChart drivers={[driverA, driverB]}/></section>
    </main>
  );
}

function DriverMetrics({ driver }: { driver: import('@f1/domain').DriverState }) {
  return <section className="compare-driver" style={{ '--team-color': driver.teamColor ?? '#9BA3AF' } as React.CSSProperties}><header><small>P{driver.position ?? '—'}</small><h2>{driver.code}</h2><span>{driver.teamName}</span></header><div><Metric label="Gap" value={formatGap(driver.gapToLeaderSec, driver.position === 1)}/><Metric label="Tyre" value={`${formatCompound(driver.currentStint?.compound ?? null)} · ${driver.currentStint?.currentAgeLaps ?? '—'}`}/><Metric label="Best" value={formatLapTime(driver.bestLapSec)}/><Metric label="Pace 3" value={formatLapTime(driver.pace3Sec)}/><Metric label="Pace 5" value={formatLapTime(driver.pace5Sec)}/><Metric label="Pits" value={Math.max(0, driver.stints.length - 1)}/></div></section>;
}
