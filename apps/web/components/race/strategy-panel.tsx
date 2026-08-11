import Link from 'next/link';
import type { DriverState, PitProjection, StrategySignal } from '@f1/domain';
import { confidenceLabel } from '@/lib/format';

export function StrategyPanel({ signals, projections, drivers }: {
  signals: StrategySignal[];
  projections: PitProjection[];
  drivers: DriverState[];
}) {
  const driversById = new Map(drivers.map((driver) => [driver.driverId, driver]));
  const disabled = projections[0]?.disabledReason;
  return (
    <section className="context-panel" aria-labelledby="strategy-title">
      <div className="panel-heading"><div><p className="eyebrow">PIT MODEL</p><h2 id="strategy-title">Strategy watch</h2></div><Link className="panel-link" href="/strategy" aria-label="Open strategy analysis">↗</Link></div>
      {disabled ? <p className="empty-copy">Pit projections paused · {disabled}</p> : signals.length === 0 ? <p className="empty-copy">No reliable pit-window signal right now.</p> : signals.map((signal) => {
        const driver = driversById.get(signal.driverId);
        const projection = projections.find((candidate) => candidate.driverId === signal.driverId);
        return <article className="strategy-signal" key={signal.id}><div><b>{driver?.code ?? 'Driver'}</b><span>{confidenceLabel(signal.confidence)}</span></div><h3>{signal.headline}</h3><p>{projection?.projectedRejoinPosition ? `Estimated rejoin P${projection.projectedRejoinPosition}` : projection?.zoneLabel ?? 'Estimated rejoin zone'}</p><small>{signal.evidence.join(' · ')}</small></article>;
      })}
      <Link className="context-action" href="/strategy">Open full strategy analysis <span aria-hidden="true">→</span></Link>
    </section>
  );
}
