import Link from 'next/link';
import type { Battle, DriverState } from '@f1/domain';
import { confidenceLabel } from '@/lib/format';

export function BattleList({ battles, drivers, sessionId }: { battles: Battle[]; drivers: DriverState[]; sessionId: string }) {
  const driversById = new Map(drivers.map((driver) => [driver.driverId, driver]));
  return (
    <section className="context-panel" id="battles" aria-labelledby="battles-title">
      <div className="panel-heading"><div><p className="eyebrow">AUTO-DETECTED</p><h2 id="battles-title">Battles</h2></div><span>{battles.length}</span></div>
      {battles.length === 0 ? <p className="empty-copy">Predictions paused while race conditions are unstable.</p> : battles.map((battle, index) => {
        const ahead = driversById.get(battle.aheadDriverId);
        const behind = driversById.get(battle.behindDriverId);
        if (!ahead || !behind) return null;
        return (
          <article className={`battle-card${index === 0 ? ' battle-card--critical' : ''}`} key={battle.id}>
            {index === 0 ? <small className="battle-card__priority">Critical battle · relevance {Math.round(battle.relevanceScore)}</small> : null}
            <div className="battle-card__codes"><strong>{behind.code}</strong><span>→</span><strong>{ahead.code}</strong></div>
            <p>Gap <b>{battle.gapSec.toFixed(1)}s</b> · {battle.closingRateSecPerLap !== null && battle.closingRateSecPerLap > 0 ? `closes ${battle.closingRateSecPerLap.toFixed(2)}/lap` : 'stable gap'}</p>
            <div><span className="confidence">{confidenceLabel(battle.confidence)}</span><span>{battle.drsState === 'inside' ? 'In estimated DRS range' : battle.drsState === 'approaching' ? `DRS in ~${battle.projectedCatchRange?.join('–') ?? '3+'} laps` : 'Outside DRS range'}</span></div>
            <small>{battle.evidence.join(' · ')}</small>
            <Link href={`/compare?session=${encodeURIComponent(sessionId)}&a=${encodeURIComponent(ahead.driverId)}&b=${encodeURIComponent(behind.driverId)}`}>Compare drivers <span aria-hidden="true">↗</span></Link>
          </article>
        );
      })}
    </section>
  );
}
