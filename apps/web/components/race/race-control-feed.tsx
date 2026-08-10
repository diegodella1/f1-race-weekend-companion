import type { RaceControlEvent } from '@f1/domain';

export function RaceControlFeed({ events }: { events: RaceControlEvent[] }) {
  return (
    <section className="context-panel" aria-labelledby="race-control-title">
      <div className="panel-heading"><div><p className="eyebrow">OFFICIAL FEED</p><h2 id="race-control-title">Race control</h2></div></div>
      {events.length === 0 ? <p className="empty-copy">No priority messages in this replay moment.</p> : (
        <ol className="race-control-list">
          {[...events].reverse().map((event) => (
            <li key={event.id} className={event.priority === 'high' ? 'high-priority' : undefined}>
              <time>{new Date(event.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
              <div><strong>{event.label ?? event.category.replace('_', ' ')}</strong><p>{event.sourceText}</p></div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
