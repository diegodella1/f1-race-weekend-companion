import { describe, expect, it } from 'vitest';
import { nextSessionPhase } from '../session-machine';

describe('session state machine', () => {
  it('supports suspension and resumption', () => {
    expect(nextSessionPhase('live', 'suspend')).toBe('suspended');
    expect(nextSessionPhase('suspended', 'resume')).toBe('live');
  });

  it('does not regress a final session without provider reset', () => {
    expect(() => nextSessionPhase('finished_final', 'start')).toThrow('Invalid session transition');
    expect(nextSessionPhase('finished_final', 'provider_reset')).toBe('pre_live');
  });

  it('keeps provisional when final confirmation is unavailable', () => {
    expect(nextSessionPhase('finishing', 'result_available')).toBe('finished_provisional');
  });
});
