import { describe, expect, it } from 'vitest';
import { getMockDriver, getMockLap, getMockSnapshot } from '../../../../packages/domain/src/__tests__/factories';
import { buildCleanLapDeltaSeries, findSectorLeaders, selectStrategyDrivers } from '../strategy-view';

const verstappen = getMockDriver({
  driverId: 'driver:1:2024',
  number: 1,
  code: 'VER',
  fullName: 'Max Verstappen',
  position: 1,
  laps: [
    getMockLap({ lapNumber: 8, timeSec: 90, sectorsSec: [30, 31, 29] }),
    getMockLap({ lapNumber: 9, timeSec: 89.5, sectorsSec: [29.8, 30.8, 28.9] })
  ]
});

const leclerc = getMockDriver({
  driverId: 'driver:16:2024',
  number: 16,
  code: 'LEC',
  fullName: 'Charles Leclerc',
  position: 2,
  intervalAheadSec: 1.2,
  laps: [
    getMockLap({ lapNumber: 8, timeSec: 90.4, sectorsSec: [29.9, 31.1, 29.4] }),
    getMockLap({ lapNumber: 9, timeSec: 89.8, sectorsSec: [29.7, 31, 29.1] })
  ]
});

const snapshot = getMockSnapshot({
  drivers: [verstappen, leclerc],
  strategySignals: [{
    id: 'strategy:undercut:VER:LEC',
    type: 'undercut_candidate',
    driverId: verstappen.driverId,
    rivalDriverId: leclerc.driverId,
    headline: 'Estimated undercut opportunity',
    confidence: 'high',
    evidence: ['Gap 1.2 s']
  }]
});

describe('strategy view models', () => {
  it('honors a valid requested pair and falls back to a relevant signal', () => {
    expect(selectStrategyDrivers(snapshot, leclerc.driverId, verstappen.driverId, null)?.map((driver) => driver.code)).toEqual(['LEC', 'VER']);
    expect(selectStrategyDrivers(snapshot, 'missing', null, null)?.map((driver) => driver.code)).toEqual(['VER', 'LEC']);
  });

  it('builds deltas only from matching clean laps', () => {
    expect(buildCleanLapDeltaSeries(verstappen, leclerc)).toEqual([
      { lapNumber: 8, deltaSec: 0.4 },
      { lapNumber: 9, deltaSec: 0.3 }
    ]);
  });

  it('finds sector leaders from measured clean sectors', () => {
    expect(findSectorLeaders([verstappen, leclerc]).map((leader) => [leader.sector, leader.driver.code, leader.timeSec])).toEqual([
      [1, 'LEC', 29.7],
      [2, 'VER', 30.8],
      [3, 'VER', 28.9]
    ]);
  });
});
