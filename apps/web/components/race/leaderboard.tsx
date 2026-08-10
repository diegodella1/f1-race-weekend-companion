import Link from 'next/link';
import type { DriverState } from '@f1/domain';
import { formatCompound, formatGap, formatLapTime } from '@/lib/format';

export function Leaderboard({ drivers, favoriteDriverId }: { drivers: DriverState[]; favoriteDriverId: string | null }) {
  return (
    <div className="leaderboard-wrap">
      <table className="leaderboard">
        <caption className="sr-only">Current race order and timing</caption>
        <thead>
          <tr><th scope="col">Pos</th><th scope="col">Driver</th><th scope="col">Interval</th><th scope="col">Tyre</th><th scope="col" className="optional-cell">Last lap</th><th scope="col" className="optional-cell">Pace 5</th></tr>
        </thead>
        <tbody>
          {drivers.map((driver) => (
            <tr key={driver.driverId} className={driver.driverId === favoriteDriverId ? 'is-favorite' : undefined}>
              <td className="position-cell">{driver.position ?? '—'}</td>
              <th scope="row">
                <Link href={`/drivers/${encodeURIComponent(driver.driverId)}`}>
                  <i style={{ '--team-color': driver.teamColor ?? '#9BA3AF' } as React.CSSProperties} />
                  <span>{driver.code}</span><small>{driver.teamName}</small>
                </Link>
              </th>
              <td>{formatGap(driver.intervalAheadSec, driver.position === 1)}</td>
              <td><span className={`compound compound--${driver.currentStint?.compound?.toLowerCase() ?? 'unknown'}`}>{formatCompound(driver.currentStint?.compound ?? null)}</span>{driver.currentStint?.currentAgeLaps ?? '—'}</td>
              <td className="optional-cell">{formatLapTime(driver.lastLapSec)}</td>
              <td className="optional-cell">{formatLapTime(driver.pace5Sec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
