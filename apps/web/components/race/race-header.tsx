import { StatusPill } from '@f1/ui';
import type { Meeting, SessionSnapshot } from '@f1/domain';
import { statusTone } from '@/lib/format';
import { ApexBrandBar } from '@/components/shared/apex-masthead';

export function RaceHeader({ meeting, snapshot }: { meeting: Meeting; snapshot: SessionSnapshot }) {
  return (
    <header className={`race-header race-header--${statusTone(snapshot.trackStatus.code)}`}>
      <ApexBrandBar />
      <div className="race-header__context">
        <div>
          <p className="eyebrow">{meeting.countryCode} · RACE CONTROL</p>
          <h1>{meeting.name}</h1>
        </div>
        <div className="race-header__lap" aria-label={`Lap ${snapshot.lap ?? 'unknown'} of ${snapshot.totalLaps ?? 'unknown'}`}>
          <span>LAP</span>
          <strong>{snapshot.lap ?? '—'}<small> / {snapshot.totalLaps ?? '—'}</small></strong>
        </div>
        <div className="race-header__status">
          <StatusPill tone={statusTone(snapshot.trackStatus.code)}>{snapshot.trackStatus.label}</StatusPill>
          <span>{snapshot.requestedDelaySeconds > 0 ? `DELAY ${Math.round(snapshot.effectiveDelaySeconds)}s · ` : ''}{snapshot.meta.provider.toUpperCase()} · {Math.round(snapshot.meta.ageSeconds)}s</span>
        </div>
      </div>
    </header>
  );
}
