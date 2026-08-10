import type { Meeting, SessionSnapshot } from '@f1/domain';
import { PreWeekend } from './pre-weekend';
import { SessionTableMode } from './session-table-mode';
import { PostRaceView } from './post-race-view';
import { RaceMode } from '@/components/race/race-mode';

export function WeekendMode({ meeting, snapshot }: { meeting: Meeting; snapshot: SessionSnapshot }) {
  if (snapshot.phase === 'scheduled' || snapshot.phase === 'pre_live' || snapshot.phase === 'unavailable') {
    return <PreWeekend meeting={meeting} />;
  }
  if (snapshot.phase === 'finished_provisional' || snapshot.phase === 'finished_final') {
    return <PostRaceView meeting={meeting} snapshot={snapshot} />;
  }
  if (snapshot.kind === 'practice' || snapshot.kind === 'qualifying') {
    return <SessionTableMode meeting={meeting} initialSnapshot={snapshot} />;
  }
  return <RaceMode meeting={meeting} initialSnapshot={snapshot} />;
}
