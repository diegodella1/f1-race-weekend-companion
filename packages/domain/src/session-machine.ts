import type { SessionPhase } from './models';

export type SessionEvent =
  | 'timing_detected'
  | 'start'
  | 'suspend'
  | 'resume'
  | 'finish_signal'
  | 'result_available'
  | 'result_confirmed'
  | 'metadata_lost'
  | 'provider_reset';

const transitions: Record<SessionPhase, Partial<Record<SessionEvent, SessionPhase>>> = {
  scheduled: { timing_detected: 'pre_live', metadata_lost: 'unavailable' },
  pre_live: { start: 'live', metadata_lost: 'unavailable' },
  live: { suspend: 'suspended', finish_signal: 'finishing', metadata_lost: 'unavailable' },
  suspended: { resume: 'live', finish_signal: 'finishing', metadata_lost: 'unavailable' },
  finishing: { result_available: 'finished_provisional', suspend: 'suspended', metadata_lost: 'unavailable' },
  finished_provisional: { result_confirmed: 'finished_final', metadata_lost: 'unavailable' },
  finished_final: { provider_reset: 'pre_live' },
  unavailable: { timing_detected: 'pre_live', start: 'live' }
};

export function nextSessionPhase(current: SessionPhase, event: SessionEvent): SessionPhase {
  const next = transitions[current][event];
  if (!next) {
    throw new Error(`Invalid session transition: ${current} -> ${event}`);
  }
  return next;
}
