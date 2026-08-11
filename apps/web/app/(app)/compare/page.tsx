import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Metric } from '@f1/ui';
import type { DriverState } from '@f1/domain';
import { ApexScreen } from '@/components/shared/apex-screen';
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
  const driverB = snapshot.drivers.find((driver) => driver.driverId === params.b && driver.driverId !== driverA?.driverId) ?? snapshot.drivers.find((driver) => driver.driverId !== driverA?.driverId);
  if (!driverA || !driverB) return <main className="center-state"><h1>Comparison unavailable</h1></main>;
  const sectorsA = bestSectors(driverA);
  const sectorsB = bestSectors(driverB);
  return (
    <ApexScreen>
      <main className="page-frame compare-page">
        <p className="eyebrow">HEAD TO HEAD · CLEAN DATA</p><h1>{driverA.code} <span>vs</span> {driverB.code}</h1>
        <form className="compare-selectors"><input type="hidden" name="session" value={sessionId}/><select aria-label="First driver" name="a" defaultValue={driverA.driverId}>{snapshot.drivers.map((driver) => <option value={driver.driverId} key={driver.driverId}>{driver.code} · {driver.fullName}</option>)}</select><span>vs</span><select aria-label="Second driver" name="b" defaultValue={driverB.driverId}>{snapshot.drivers.map((driver) => <option value={driver.driverId} key={driver.driverId}>{driver.code} · {driver.fullName}</option>)}</select><button type="submit">Compare drivers</button></form>
        <div className="comparison-grid"><DriverMetrics driver={driverA}/><DriverMetrics driver={driverB}/></div>
        <section className="surface sector-comparison"><div className="panel-heading"><div><p className="eyebrow">BEST MEASURED</p><h2>Sector comparison</h2></div></div><div className="sector-comparison__grid"><span>Sector</span><b>{driverA.code}</b><b>{driverB.code}</b>{[0, 1, 2].map((index) => <div className="sector-comparison__row" key={index}><span>S{index + 1}</span><strong className={sectorWins(sectorsA[index] ?? null, sectorsB[index] ?? null) === 'a' ? 'is-best' : undefined}>{formatLapTime(sectorsA[index] ?? null)}</strong><strong className={sectorWins(sectorsA[index] ?? null, sectorsB[index] ?? null) === 'b' ? 'is-best' : undefined}>{formatLapTime(sectorsB[index] ?? null)}</strong></div>)}</div></section>
        <section className="surface chart-surface"><div className="panel-heading"><div><p className="eyebrow">PACE TRACE</p><h2>Clean lap time</h2></div></div><LapChart drivers={[driverA, driverB]}/></section>
        <Link className="primary-action compare-strategy-link" href={`/strategy?a=${encodeURIComponent(driverA.driverId)}&b=${encodeURIComponent(driverB.driverId)}`}>Analyze this strategy pair</Link>
      </main>
    </ApexScreen>
  );
}

function DriverMetrics({ driver }: { driver: DriverState }) {
  return <section className="compare-driver" style={{ '--team-color': driver.teamColor ?? '#9BA3AF' } as CSSProperties}><header><small>P{driver.position ?? '—'}</small><h2>{driver.code}</h2><span>{driver.fullName} · {driver.teamName}</span></header><div><Metric label="Gap" value={formatGap(driver.gapToLeaderSec, driver.position === 1)}/><Metric label="Tyre" value={`${formatCompound(driver.currentStint?.compound ?? null)} · ${driver.currentStint?.currentAgeLaps ?? '—'}`}/><Metric label="Best" value={formatLapTime(driver.bestLapSec)}/><Metric label="Pace 3" value={formatLapTime(driver.pace3Sec)}/><Metric label="Pace 5" value={formatLapTime(driver.pace5Sec)}/><Metric label="Pits" value={Math.max(0, driver.stints.length - 1)}/></div></section>;
}

function bestSectors(driver: DriverState): Array<number | null> {
  const best: Array<number | null> = [null, null, null];
  for (const lap of driver.laps) {
    if (!lap.clean) continue;
    lap.sectorsSec.forEach((sector, index) => {
      if (sector !== null && (best[index] === null || sector < best[index]!)) best[index] = sector;
    });
  }
  return best;
}

function sectorWins(a: number | null, b: number | null): 'a' | 'b' | null {
  if (a === null || b === null || a === b) return null;
  return a < b ? 'a' : 'b';
}
