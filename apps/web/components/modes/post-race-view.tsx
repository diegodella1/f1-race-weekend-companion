import type { CSSProperties } from 'react';
import Link from 'next/link';
import type { Meeting, SessionSnapshot } from '@f1/domain';
import { ApexScreen } from '@/components/shared/apex-screen';
import { formatCompound, formatGap, formatLapTime } from '@/lib/format';

export function PostRaceView({ meeting, snapshot }: { meeting: Meeting; snapshot: SessionSnapshot }) {
  const podium = snapshot.drivers.filter((driver) => (driver.position ?? 99) <= 3);
  return (
    <ApexScreen>
      <main className="page-frame post-race">
        <p className="eyebrow">{snapshot.phase === 'finished_final' ? 'FINAL RESULT' : 'PROVISIONAL RESULT'}</p>
        <h1>{meeting.name}</h1>
        <section className="podium" aria-label="Podium">{podium.map((driver) => <div key={driver.driverId} data-position={driver.position}><small>P{driver.position}</small><strong>{driver.code}</strong><span>{driver.fullName}</span></div>)}</section>
        <section className="surface post-classification" aria-labelledby="classification-title">
          <div className="panel-heading"><div><p className="eyebrow">SESSION RESULT</p><h2 id="classification-title">Classification</h2></div><span>{snapshot.drivers.length}</span></div>
          <div className="leaderboard-wrap"><table className="leaderboard"><thead><tr><th>Pos</th><th>Driver</th><th>Gap</th><th>Best</th><th>Tyre</th><th>Stops</th></tr></thead><tbody>{snapshot.drivers.map((driver) => <tr key={driver.driverId}><td className="position-cell">{driver.position ?? '—'}</td><th><Link href={`/drivers/${encodeURIComponent(driver.driverId)}`}><i style={{ '--team-color': driver.teamColor ?? '#9BA3AF' } as CSSProperties}/><span>{driver.code}</span><small>{driver.teamName}</small></Link></th><td>{formatGap(driver.gapToLeaderSec, driver.position === 1)}</td><td>{formatLapTime(driver.bestLapSec)}</td><td>{formatCompound(driver.currentStint?.compound ?? null)}</td><td>{Math.max(0, driver.stints.length - 1)}</td></tr>)}</tbody></table></div>
        </section>
        <section className="post-facts"><h2>Race facts</h2><ul>
          <li>{snapshot.drivers[0]?.fullName ?? 'Winner pending'} leads the supplied classification.</li>
          <li>{snapshot.raceControl.length} race-control messages recorded.</li>
          <li>{snapshot.drivers.reduce((sum, driver) => sum + Math.max(0, driver.stints.length - 1), 0)} pit stops represented.</li>
        </ul></section>
        <div className="post-actions"><Link className="primary-action" href="/weekend">Replay session</Link><Link href="/compare">Compare drivers</Link></div>
        {meeting.nextMeeting ? <p className="next-race">Next: <b>{meeting.nextMeeting.name}</b> · {new Date(meeting.nextMeeting.startsAt).toLocaleString()}</p> : null}
      </main>
    </ApexScreen>
  );
}
