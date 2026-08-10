import Link from 'next/link';
import type { Battle, DriverState } from '@f1/domain';
import { formatCompound, formatGap, formatLapTime } from '@/lib/format';

export function FavoriteStrip({ driver, battle }: { driver: DriverState | null; battle: Battle | null }) {
  if (!driver) {
    return <Link className="favorite-strip favorite-strip--empty" href="/settings"><span>☆</span><strong>Choose your favorite driver</strong><small>Keep their race in view</small></Link>;
  }
  return (
    <Link className="favorite-strip" href={`/drivers/${encodeURIComponent(driver.driverId)}`}>
      <span className="favorite-star" aria-hidden="true">★</span>
      <div><small>YOUR DRIVER</small><strong>{driver.code} <b>P{driver.position ?? '—'}</b></strong></div>
      <div><small>INTERVAL</small><strong>{formatGap(driver.intervalAheadSec, driver.position === 1)}</strong></div>
      <div><small>TYRE</small><strong>{formatCompound(driver.currentStint?.compound ?? null)} · {driver.currentStint?.currentAgeLaps ?? '—'}</strong></div>
      <div className="optional-favorite"><small>PACE 5</small><strong>{formatLapTime(driver.pace5Sec)}</strong></div>
      <div className="favorite-battle"><small>NEAREST BATTLE</small><strong>{battle ? `${battle.gapSec.toFixed(1)}s · ${battle.confidence}` : 'No close battle'}</strong></div>
    </Link>
  );
}
