import { describe, expect, it } from 'vitest';
import { buildInsights, validateInsightEvidence } from '../insights';
import { getMockDriver, getMockSnapshot } from './factories';

describe('deterministic insights', () => {
  it('maps every number in a headline to evidence', () => {
    const ahead = getMockDriver({ driverId: 'driver:16:2024', code: 'LEC', position: 3 });
    const behind = getMockDriver({ driverId: 'driver:81:2024', code: 'PIA', position: 4 });
    const snapshot = getMockSnapshot({
      drivers: [ahead, behind],
      battles: [{
        id: 'battle:LEC:PIA', aheadDriverId: ahead.driverId, behindDriverId: behind.driverId,
        gapSec: 1.4, closingRateSecPerLap: 0.18, projectedCatchLaps: 3,
        projectedCatchRange: [2, 4], drsState: 'approaching', relevanceScore: 82,
        confidence: 'medium', evidence: ['Gap 1.4 s', 'Closing 0.18 s/lap', 'Sample 4 clean laps'], sampleSize: 4
      }]
    });

    const insights = buildInsights(null, snapshot, null);

    expect(insights[0]?.headline).toContain('PIA closes on LEC');
    expect(validateInsightEvidence(insights[0]!)).toBe(true);
  });

  it('prioritizes a race-status change over battles', () => {
    const previous = getMockSnapshot();
    const current = getMockSnapshot({ trackStatus: { code: 'VSC', label: 'Virtual Safety Car' } });
    expect(buildInsights(previous, current, null)[0]?.type).toBe('race_status');
  });
});
