import type { DriverState, Lap, SessionSnapshot } from '../models';

export function getMockLap(overrides: Partial<Lap> = {}): Lap {
  return {
    lapNumber: 2,
    timeSec: 90,
    sectorsSec: [30, 30, 30],
    startedAt: '2024-06-30T13:02:00.000Z',
    compound: 'MEDIUM',
    isPitIn: false,
    isPitOut: false,
    trackStatus: 'GREEN',
    clean: true,
    exclusionReasons: [],
    ...overrides
  };
}

export function getMockDriver(overrides: Partial<DriverState> = {}): DriverState {
  return {
    driverId: 'driver:4:2024',
    number: 4,
    code: 'NOR',
    fullName: 'Lando Norris',
    teamName: 'McLaren',
    teamColor: '#FF8700',
    position: 1,
    status: 'running',
    gapToLeaderSec: 0,
    intervalAheadSec: null,
    lastLapSec: 89.8,
    bestLapSec: 89.2,
    pace3Sec: 89.7,
    pace5Sec: 89.8,
    currentStint: {
      index: 1,
      compound: 'MEDIUM',
      startLap: 10,
      endLap: null,
      tyreAgeAtStart: 0,
      currentAgeLaps: 8
    },
    stints: [],
    laps: [],
    ...overrides
  };
}

export function getMockSnapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    id: 'session:replay:demo-race-2024',
    meetingId: 'meeting:replay:demo-2024',
    kind: 'race',
    phase: 'live',
    segment: null,
    startedAt: '2024-06-30T13:00:00.000Z',
    endsAt: null,
    clockSeconds: null,
    lap: 17,
    totalLaps: 71,
    trackStatus: { code: 'GREEN', label: 'Green flag' },
    drivers: [getMockDriver()],
    raceControl: [],
    battles: [],
    pitProjections: [],
    strategySignals: [],
    insights: [],
    revision: 1,
    requestedDelaySeconds: 0,
    effectiveDelaySeconds: 0,
    meta: {
      provider: 'replay',
      sourceUpdatedAt: '2024-06-30T13:25:00.000Z',
      ingestedAt: '2024-06-30T13:25:01.000Z',
      stale: false,
      ageSeconds: 1
    },
    ...overrides
  };
}
