import { describe, expect, it } from 'vitest';
import {
  calculateConfidence,
  calculatePace,
  calculatePitProjection,
  detectStrategySignals,
  calculateTyreAge,
  classifyDrs,
  detectBattles,
  markCleanLaps,
  projectCatch
} from '../metrics';
import { getMockDriver, getMockLap } from './factories';

describe('clean lap filtering', () => {
  it('records every observable exclusion reason', () => {
    const laps = [
      getMockLap({ lapNumber: 1 }),
      getMockLap({ lapNumber: 2, isPitOut: true, trackStatus: 'VSC' }),
      getMockLap({ lapNumber: 3, timeSec: null })
    ];

    const result = markCleanLaps(laps, 'race');

    expect(result[0]?.exclusionReasons).toContain('first_lap');
    expect(result[1]?.exclusionReasons).toEqual(expect.arrayContaining(['pit_out', 'neutralized']));
    expect(result[2]?.exclusionReasons).toContain('invalid_time');
    expect(result.every((lap) => !lap.clean)).toBe(true);
  });

  it('uses a seven-percent outlier threshold in race mode', () => {
    const baseline = Array.from({ length: 7 }, (_, index) =>
      getMockLap({ lapNumber: index + 2, timeSec: 90 + (index % 2) * 0.1 })
    );
    const result = markCleanLaps([...baseline, getMockLap({ lapNumber: 9, timeSec: 98 })], 'race');
    expect(result.at(-1)?.exclusionReasons).toContain('pace_outlier');
  });
});

describe('pace', () => {
  it('trims fastest and slowest values from five clean laps', () => {
    const laps = [88, 90, 91, 92, 100].map((timeSec, index) =>
      getMockLap({ lapNumber: index + 2, timeSec })
    );
    expect(calculatePace(laps, 5)).toEqual({ value: 91, sampleSize: 5 });
  });

  it('requires at least three clean laps', () => {
    expect(calculatePace([getMockLap(), getMockLap({ lapNumber: 3 })], 3)).toEqual({
      value: null,
      sampleSize: 2
    });
  });
});

describe('race heuristics', () => {
  it('returns catch ranges rather than false precision', () => {
    expect(projectCatch(1.6, 0.2, 1, 20, 'medium')).toEqual({
      value: 3,
      minLaps: 1,
      maxLaps: 5
    });
    expect(projectCatch(1.6, 0.04, 1, 20, 'high')).toBeNull();
  });

  it('uses estimated wording when DRS enablement is unknown', () => {
    expect(classifyDrs(0.8, 0.1, null)).toEqual({ state: 'inside', estimated: true });
    expect(classifyDrs(1.5, 0.1, true)).toEqual({ state: 'approaching', estimated: false });
  });

  it('ranks an adjacent favorite battle above a distant pair', () => {
    const leader = getMockDriver();
    const favorite = getMockDriver({
      driverId: 'driver:16:2024', number: 16, code: 'LEC', fullName: 'Charles Leclerc',
      position: 2, gapToLeaderSec: 1.2, intervalAheadSec: 1.2, pace5Sec: 89.4
    });
    const third = getMockDriver({
      driverId: 'driver:81:2024', number: 81, code: 'PIA', fullName: 'Oscar Piastri',
      position: 3, gapToLeaderSec: 3.9, intervalAheadSec: 2.7, pace5Sec: 89.6
    });
    const battles = detectBattles([leader, favorite, third], favorite.driverId, 'GREEN', 5);
    expect(battles[0]?.behindDriverId).toBe(favorite.driverId);
    expect(battles).toHaveLength(2);
  });

  it('disables battle predictions under VSC', () => {
    const drivers = [
      getMockDriver(),
      getMockDriver({ driverId: 'driver:1:2024', position: 2, gapToLeaderSec: 1, intervalAheadSec: 1 })
    ];
    expect(detectBattles(drivers, null, 'VSC', 4)).toEqual([]);
  });
});

describe('tyres, pits, and confidence', () => {
  it('includes age at stint start', () => {
    expect(calculateTyreAge(20, { startLap: 10, tyreAgeAtStart: 3 })).toBe(14);
  });

  it('never exposes an exact low-confidence rejoin position', () => {
    const drivers = [
      getMockDriver(),
      getMockDriver({ driverId: 'driver:1:2024', position: 2, gapToLeaderSec: 10, intervalAheadSec: 10 })
    ];
    const projection = calculatePitProjection(drivers[0]!, drivers, 22, 'low', 'GREEN');
    expect(projection.projectedRejoinPosition).toBeNull();
    expect(projection.zoneLabel).toBe('Estimated rejoin zone');
  });

  it('marks data older than thirty seconds unavailable', () => {
    expect(calculateConfidence({ samples: 8, ageSeconds: 31, madSec: 0.1, disrupted: false })).toBe('unavailable');
    expect(calculateConfidence({ samples: 5, ageSeconds: 4, madSec: 0.15, disrupted: false })).toBe('high');
  });

  it('labels an undercut candidate as an estimate with evidence', () => {
    const ahead = getMockDriver({
      driverId: 'driver:16:2024', code: 'LEC', position: 3, gapToLeaderSec: 8.4,
      intervalAheadSec: 6.3, pace5Sec: 69.2,
      currentStint: { index: 1, compound: 'HARD', startLap: 30, endLap: null, tyreAgeAtStart: 0, currentAgeLaps: 14 }
    });
    const chaser = getMockDriver({
      driverId: 'driver:81:2024', code: 'PIA', position: 4, gapToLeaderSec: 9.8,
      intervalAheadSec: 1.4, pace5Sec: 68.9,
      currentStint: { index: 1, compound: 'HARD', startLap: 31, endLap: null, tyreAgeAtStart: 0, currentAgeLaps: 13 }
    });
    const projections = [calculatePitProjection(ahead, [ahead, chaser], 22, 'medium', 'GREEN'), calculatePitProjection(chaser, [ahead, chaser], 22, 'medium', 'GREEN')];
    const signals = detectStrategySignals([ahead, chaser], projections, 'GREEN', 4);
    expect(signals[0]).toMatchObject({ type: 'undercut_candidate', driverId: chaser.driverId, confidence: 'medium' });
    expect(signals[0]?.headline).toContain('Estimated');
    expect(signals[0]?.evidence.join(' ')).toContain('0.30 s/lap');
  });

  it('suppresses strategy signals for stale or neutralized data', () => {
    const drivers = [getMockDriver(), getMockDriver({ driverId: 'driver:1:2024', position: 2, intervalAheadSec: 1 })];
    expect(detectStrategySignals(drivers, [], 'VSC', 2)).toEqual([]);
    expect(detectStrategySignals(drivers, [], 'GREEN', 16)).toEqual([]);
  });
});
