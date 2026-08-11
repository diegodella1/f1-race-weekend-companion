'use client';

import type { CSSProperties } from 'react';
import type { DriverState, Meeting, SessionSnapshot } from '@f1/domain';
import { DataStateBanner } from '@/components/shared/data-state-banner';
import { BottomNav } from '@/components/shared/bottom-nav';
import { RaceHeader } from '@/components/race/race-header';
import { useLiveSession } from '@/lib/client/use-live-session';
import { usePreferences } from '@/lib/client/preferences';
import { buildCleanLapDeltaSeries, selectStrategyDrivers } from '@/lib/strategy-view';
import { confidenceLabel, formatCompound, formatLapTime } from '@/lib/format';

export function StrategyMode({ meeting, initialSnapshot, requestedPrimaryId, requestedRivalId }: {
  meeting: Meeting;
  initialSnapshot: SessionSnapshot;
  requestedPrimaryId: string | null;
  requestedRivalId: string | null;
}) {
  const favoriteDriverId = usePreferences((state) => state.favoriteDriverId);
  const { data: snapshot, streamHealthState, streamConnected } = useLiveSession(initialSnapshot.id, initialSnapshot);
  const selected = selectStrategyDrivers(snapshot, requestedPrimaryId, requestedRivalId, favoriteDriverId);
  const availablePhase = !['scheduled', 'pre_live', 'unavailable'].includes(snapshot.phase);
  const availableKind = snapshot.kind === 'race' || snapshot.kind === 'sprint';

  return (
    <div className="app-shell strategy-screen">
      <main className="race-layout">
        <RaceHeader meeting={meeting} snapshot={snapshot} />
        <DataStateBanner snapshot={snapshot} healthState={streamHealthState} streamConnected={streamConnected} />
        <section className="strategy-hero">
          <p className="eyebrow">LIVE MODEL · EVIDENCE FIRST</p>
          <h1>Strategy <span>Analysis</span></h1>
          <p>Clean-lap pace, current stints and projected pit rejoin. Estimates stay visibly labeled.</p>
        </section>
        {!availableKind || !availablePhase ? (
          <section className="surface strategy-unavailable"><p className="eyebrow">MODEL PAUSED</p><h2>Strategy analysis is unavailable</h2><p>It becomes available during a race or sprint when the timing feed contains enough evidence.</p></section>
        ) : !selected ? (
          <section className="surface strategy-unavailable"><p className="eyebrow">NOT ENOUGH DATA</p><h2>Two drivers are required</h2><p>The provider has not supplied enough classified drivers for a comparison.</p></section>
        ) : <StrategyAnalysis snapshot={snapshot} primary={selected[0]} rival={selected[1]} />}
      </main>
      <BottomNav favoriteDriverId={favoriteDriverId} />
    </div>
  );
}

function StrategyAnalysis({ snapshot, primary, rival }: { snapshot: SessionSnapshot; primary: DriverState; rival: DriverState }) {
  const points = buildCleanLapDeltaSeries(primary, rival);
  const relevantDriverIds = new Set([primary.driverId, rival.driverId]);
  const signals = snapshot.strategySignals.filter((signal) => relevantDriverIds.has(signal.driverId) || relevantDriverIds.has(signal.rivalDriverId));
  const projections = snapshot.pitProjections.filter((projection) => relevantDriverIds.has(projection.driverId));
  const disabledReason = projections.find((projection) => projection.disabledReason)?.disabledReason;
  const driverById = new Map(snapshot.drivers.map((driver) => [driver.driverId, driver]));

  return (
    <div className="strategy-content">
      <form className="strategy-selectors" action="/strategy">
        <label><span>Primary driver</span><select name="a" defaultValue={primary.driverId}>{snapshot.drivers.map((driver) => <option value={driver.driverId} key={driver.driverId}>{driver.code} · {driver.fullName}</option>)}</select></label>
        <span className="strategy-selectors__vs">vs</span>
        <label><span>Rival</span><select name="b" defaultValue={rival.driverId}>{snapshot.drivers.map((driver) => <option value={driver.driverId} key={driver.driverId}>{driver.code} · {driver.fullName}</option>)}</select></label>
        <button type="submit">Update analysis</button>
      </form>

      <section className="surface strategy-chart-panel" aria-labelledby="pace-delta-title">
        <div className="panel-heading"><div><p className="eyebrow">CLEAN LAPS ONLY</p><h2 id="pace-delta-title">Pace delta</h2></div><span>{points.length}</span></div>
        <PaceDeltaChart points={points} primaryCode={primary.code} rivalCode={rival.code} />
      </section>

      <div className="strategy-driver-grid">
        <StrategyDriverCard driver={primary} />
        <StrategyDriverCard driver={rival} />
      </div>

      <div className="strategy-evidence-grid">
        <section className="surface strategy-feed" aria-labelledby="signals-title">
          <div className="panel-heading"><div><p className="eyebrow">PROVIDER EVIDENCE</p><h2 id="signals-title">Signals</h2></div><span>{signals.length}</span></div>
          {disabledReason ? <p className="empty-copy">Pit projections paused · {disabledReason}</p> : signals.length === 0 ? <p className="empty-copy">No reliable undercut or overcut signal for this pair right now.</p> : signals.map((signal) => <article key={signal.id} className="strategy-feed__item"><div><b>{driverById.get(signal.driverId)?.code ?? 'Driver'}</b><span>{confidenceLabel(signal.confidence)}</span></div><h3>{signal.headline}</h3><p>{signal.evidence.join(' · ')}</p></article>)}
        </section>
        <section className="surface strategy-feed" aria-labelledby="rejoin-title">
          <div className="panel-heading"><div><p className="eyebrow">PIT-LOSS MODEL</p><h2 id="rejoin-title">Projected rejoin</h2></div><span>{projections.length}</span></div>
          {disabledReason ? <p className="empty-copy">Rejoin estimates paused · {disabledReason}</p> : projections.length === 0 ? <p className="empty-copy">No reliable projected rejoin is available for this pair.</p> : projections.map((projection) => <article key={projection.driverId} className="strategy-rejoin"><b>{driverById.get(projection.driverId)?.code ?? 'Driver'}</b><strong>{projection.projectedRejoinPosition ? `P${projection.projectedRejoinPosition}` : projection.zoneLabel ?? 'Unavailable'}</strong><span>{confidenceLabel(projection.confidence)} confidence</span><small>Estimated pit loss {projection.estimatedPitLossSec.toFixed(1)}s</small></article>)}
        </section>
      </div>
    </div>
  );
}

function StrategyDriverCard({ driver }: { driver: DriverState }) {
  return (
    <article className="strategy-driver" style={{ '--team-color': driver.teamColor ?? '#8f8f8f' } as CSSProperties}>
      <header><span>P{driver.position ?? '—'}</span><h2>{driver.code}</h2><small>{driver.fullName} · {driver.teamName}</small></header>
      <div><span>Compound<strong>{formatCompound(driver.currentStint?.compound ?? null)}</strong></span><span>Tyre age<strong>{driver.currentStint?.currentAgeLaps ?? '—'} laps</strong></span><span>Pace 5<strong>{formatLapTime(driver.pace5Sec)}</strong></span><span>Stops<strong>{Math.max(0, driver.stints.length - 1)}</strong></span></div>
    </article>
  );
}

function PaceDeltaChart({ points, primaryCode, rivalCode }: { points: ReturnType<typeof buildCleanLapDeltaSeries>; primaryCode: string; rivalCode: string }) {
  if (points.length < 2) return <p className="empty-copy">At least two shared clean laps are required for a pace trace.</p>;
  const width = 720;
  const height = 260;
  const pad = 30;
  const minLap = Math.min(...points.map((point) => point.lapNumber));
  const maxLap = Math.max(...points.map((point) => point.lapNumber));
  const extent = Math.max(0.25, ...points.map((point) => Math.abs(point.deltaSec)));
  const x = (lap: number) => pad + ((lap - minLap) / Math.max(1, maxLap - minLap)) * (width - pad * 2);
  const y = (delta: number) => height / 2 - (delta / extent) * (height / 2 - pad);
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.lapNumber).toFixed(1)} ${y(point.deltaSec).toFixed(1)}`).join(' ');
  return <figure className="strategy-delta-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${rivalCode} lap-time delta against ${primaryCode}`}><line x1={pad} y1={height / 2} x2={width - pad} y2={height / 2} className="strategy-chart-zero"/><path d={path} className="strategy-chart-line"/>{points.map((point) => <circle key={point.lapNumber} cx={x(point.lapNumber)} cy={y(point.deltaSec)} r="4"><title>{`Lap ${point.lapNumber}: ${point.deltaSec > 0 ? '+' : ''}${point.deltaSec.toFixed(3)}s`}</title></circle>)}</svg><figcaption><b>{rivalCode} − {primaryCode}</b><span>Above zero: {rivalCode} slower · below zero: {rivalCode} faster</span></figcaption></figure>;
}
