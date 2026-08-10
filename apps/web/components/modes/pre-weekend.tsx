import Link from 'next/link';
import type { Meeting } from '@f1/domain';

export function PreWeekend({ meeting }: { meeting: Meeting }) {
  const nextSession = meeting.sessions.find((session) => ['scheduled', 'pre_live'].includes(session.phase)) ?? meeting.sessions[0];
  return (
    <main className="pre-weekend page-frame">
      <p className="eyebrow">NEXT RACE WEEKEND · {meeting.countryCode}</p>
      <h1>{meeting.name}</h1>
      <p className="pre-weekend__circuit">{meeting.circuitName}</p>
      <section className="countdown-card">
        <small>NEXT SESSION</small>
        <h2>{nextSession?.name ?? 'Schedule pending'}</h2>
        <time>{nextSession ? new Date(nextSession.startsAt).toLocaleString() : 'Time unavailable'}</time>
        <p>Live data starts near session time.</p>
      </section>
      <ol className="session-schedule">{meeting.sessions.map((session) => <li key={session.id}><span>{session.name}</span><time>{new Date(session.startsAt).toLocaleString()}</time></li>)}</ol>
      <Link className="primary-action" href="/settings">Choose favorite driver</Link>
      {meeting.nextMeeting ? <p className="next-race">After this: <b>{meeting.nextMeeting.name}</b> · {new Date(meeting.nextMeeting.startsAt).toLocaleDateString()}</p> : null}
    </main>
  );
}
