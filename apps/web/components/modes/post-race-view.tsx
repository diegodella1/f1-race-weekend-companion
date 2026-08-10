import Link from 'next/link';
import type { Meeting, SessionSnapshot } from '@f1/domain';

export function PostRaceView({ meeting, snapshot }: { meeting: Meeting; snapshot: SessionSnapshot }) {
  const podium = snapshot.drivers.filter((driver) => (driver.position ?? 99) <= 3);
  return (
    <main className="page-frame post-race">
      <p className="eyebrow">{snapshot.phase === 'finished_final' ? 'FINAL RESULT' : 'PROVISIONAL RESULT'}</p>
      <h1>{meeting.name}</h1>
      <section className="podium" aria-label="Podium">{podium.map((driver) => <div key={driver.driverId} data-position={driver.position}><small>P{driver.position}</small><strong>{driver.code}</strong><span>{driver.fullName}</span></div>)}</section>
      <section className="post-facts"><h2>Race facts</h2><ul>
        <li>{snapshot.drivers[0]?.fullName ?? 'Winner pending'} leads provisional classification.</li>
        <li>{snapshot.raceControl.length} race-control changes recorded in replay.</li>
        <li>{snapshot.drivers.reduce((sum, driver) => sum + Math.max(0, driver.stints.length - 1), 0)} pit stops represented.</li>
      </ul></section>
      <div className="post-actions"><Link className="primary-action" href="/weekend">Replay session</Link><Link href="/compare">Compare drivers</Link></div>
      {meeting.nextMeeting ? <p className="next-race">Next: <b>{meeting.nextMeeting.name}</b> · {new Date(meeting.nextMeeting.startsAt).toLocaleString()}</p> : null}
    </main>
  );
}
