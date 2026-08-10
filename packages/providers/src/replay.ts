import { readFile } from 'node:fs/promises';
import type { Clock, Meeting, SessionSnapshot, SessionSummary, Track } from '@f1/domain';
import {
  calculatePace,
  driverStateSchema,
  markCleanLaps,
  meetingSchema,
  raceControlEventSchema,
  sessionPhaseSchema,
  sessionSnapshotSchema,
  trackSchema,
  trackStatusSchema
} from '@f1/domain';
import { z } from 'zod';
import type { ProviderUpdateBatch, TimingProvider } from './types';
import { ProviderError } from './types';

const replayDriverSchema = z.object({
  number: z.number().int().nonnegative(),
  code: z.string(),
  name: z.string(),
  team: z.string(),
  color: z.string().nullable(),
  position: z.number().int().positive(),
  gap: z.number().nonnegative(),
  interval: z.number().nonnegative().nullable(),
  compound: z.enum(['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET', 'TEST_UNKNOWN']),
  stintStart: z.number().int().positive(),
  pitLap: z.number().int().positive(),
  lapTimes: z.array(z.number().positive()).min(12)
});

const replayFixtureSchema = z.object({
  schemaVersion: z.literal(1),
  meeting: meetingSchema,
  track: trackSchema,
  session: z.object({
    id: z.string(),
    meetingId: z.string(),
    kind: z.enum(['practice', 'qualifying', 'sprint', 'race']),
    phase: sessionPhaseSchema,
    segment: z.enum(['Q1', 'Q2', 'Q3']).nullable(),
    startedAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime().nullable(),
    clockSeconds: z.number().nonnegative().nullable(),
    lap: z.number().int().nonnegative(),
    totalLaps: z.number().int().positive(),
    trackStatus: trackStatusSchema,
    sourceUpdatedAt: z.iso.datetime(),
    drivers: z.array(replayDriverSchema).min(8)
  })
});

const replayEventSchema = z.discriminatedUnion('type', [
  z.object({
    atMs: z.number().int().nonnegative(),
    type: z.literal('gap'),
    payload: z.object({ driverNumber: z.number().int(), gap: z.number().nonnegative(), interval: z.number().nonnegative().nullable() })
  }),
  z.object({
    atMs: z.number().int().nonnegative(),
    type: z.literal('status'),
    payload: z.object({ trackStatus: trackStatusSchema, raceControl: raceControlEventSchema })
  }),
  z.object({
    atMs: z.number().int().nonnegative(),
    type: z.literal('phase'),
    payload: z.object({
      phase: sessionPhaseSchema,
      trackStatus: trackStatusSchema.optional(),
      lap: z.number().int().nonnegative().optional(),
      endsAt: z.iso.datetime().nullable().optional()
    })
  })
]);

type ReplayFixture = z.infer<typeof replayFixtureSchema>;
type ReplayEvent = z.infer<typeof replayEventSchema>;

export interface ReplayAdapterOptions {
  fixturePath: string;
  eventsPath: string;
  clock: Clock;
}

export class ReplayAdapter implements TimingProvider {
  readonly name = 'replay';
  private positionMs = 0;
  private speed = 1;
  private playing = false;
  private playStartedAtMs = 0;

  private constructor(
    private readonly fixture: ReplayFixture,
    private readonly events: ReplayEvent[],
    private readonly clock: Clock
  ) {}

  static async create(options: ReplayAdapterOptions): Promise<ReplayAdapter> {
    const [fixtureText, eventText] = await Promise.all([
      readFile(options.fixturePath, 'utf8'),
      readFile(options.eventsPath, 'utf8')
    ]);
    const fixture = replayFixtureSchema.parse(JSON.parse(fixtureText));
    const events = eventText
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => replayEventSchema.parse(JSON.parse(line)))
      .sort((left, right) => left.atMs - right.atMs);
    return new ReplayAdapter(fixture, events, options.clock);
  }

  capabilities() {
    return {
      gaps: true,
      sectors: true,
      stints: true,
      raceControl: true,
      weather: false,
      physicalOrder: true,
      drsStatus: false,
      finalClassification: false,
      livePush: false
    } as const;
  }

  async getMeetings(): Promise<Meeting[]> {
    return [this.fixture.meeting];
  }

  async getSessions(meetingId: string): Promise<SessionSummary[]> {
    if (meetingId !== this.fixture.meeting.id) return [];
    return this.fixture.meeting.sessions;
  }

  async getSessionSnapshot(sessionId: string): Promise<SessionSnapshot> {
    this.assertSession(sessionId);
    return sessionSnapshotSchema.parse(this.createSnapshot(this.elapsedMs()));
  }

  async getHistoricalSession(sessionId: string): Promise<SessionSnapshot> {
    return this.getSessionSnapshot(sessionId);
  }

  async getUpdates(sessionId: string, since?: string): Promise<ProviderUpdateBatch> {
    const snapshot = await this.getSessionSnapshot(sessionId);
    const cursor = String(snapshot.revision);
    return {
      updates: since === cursor ? [] : [{ cursor, snapshot }],
      nextCursor: cursor
    };
  }

  getMeeting(): Meeting {
    return this.fixture.meeting;
  }

  getTrack(): Track {
    return this.fixture.track;
  }

  getState(): { playing: boolean; speed: number; positionMs: number; durationMs: number } {
    return {
      playing: this.playing,
      speed: this.speed,
      positionMs: this.elapsedMs(),
      durationMs: this.events.at(-1)?.atMs ?? 0
    };
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.playStartedAtMs = this.clock.now().getTime();
  }

  pause(): void {
    if (!this.playing) return;
    this.positionMs = this.elapsedMs();
    this.playing = false;
  }

  setSpeed(speed: 1 | 4 | 16): void {
    const position = this.elapsedMs();
    this.positionMs = position;
    this.speed = speed;
    this.playStartedAtMs = this.clock.now().getTime();
  }

  seek(positionMs: number): void {
    const duration = this.events.at(-1)?.atMs ?? 0;
    this.positionMs = Math.max(0, Math.min(positionMs, duration));
    this.playStartedAtMs = this.clock.now().getTime();
  }

  reset(): void {
    this.positionMs = 0;
    this.playStartedAtMs = this.clock.now().getTime();
    this.playing = false;
    this.speed = 1;
  }

  private elapsedMs(): number {
    if (!this.playing) return this.positionMs;
    const elapsed = (this.clock.now().getTime() - this.playStartedAtMs) * this.speed;
    const duration = this.events.at(-1)?.atMs ?? 0;
    return Math.min(duration, this.positionMs + elapsed);
  }

  private assertSession(sessionId: string): void {
    if (sessionId !== this.fixture.session.id) {
      throw new ProviderError(`Replay session not found: ${sessionId}`, 'SESSION_NOT_FOUND', false, 404);
    }
  }

  private createSnapshot(atMs: number): SessionSnapshot {
    const source = this.fixture.session;
    const currentLap = source.lap;
    const drivers = source.drivers.map((driver) => {
      const firstLapNumber = currentLap - driver.lapTimes.length + 1;
      const rawLaps = driver.lapTimes.map((timeSec, index) => {
        const lapNumber = firstLapNumber + index;
        return {
          lapNumber,
          timeSec,
          sectorsSec: [timeSec * 0.32, timeSec * 0.36, timeSec * 0.32].map((sector) => Number(sector.toFixed(3))),
          startedAt: new Date(Date.parse(source.sourceUpdatedAt) - (driver.lapTimes.length - index) * 70_000).toISOString(),
          compound: driver.compound,
          isPitIn: lapNumber === driver.pitLap,
          isPitOut: lapNumber === driver.stintStart,
          trackStatus: 'GREEN' as const,
          clean: true,
          exclusionReasons: []
        };
      });
      const laps = markCleanLaps(rawLaps, source.kind);
      const pace3 = calculatePace(laps, 3);
      const pace5 = calculatePace(laps, 5);
      return driverStateSchema.parse({
        driverId: `driver:${driver.number}:2024`,
        number: driver.number,
        code: driver.code,
        fullName: driver.name,
        teamName: driver.team,
        teamColor: driver.color,
        position: driver.position,
        status: 'running',
        gapToLeaderSec: driver.gap,
        intervalAheadSec: driver.interval,
        lastLapSec: driver.lapTimes.at(-1) ?? null,
        bestLapSec: Math.min(...driver.lapTimes),
        pace3Sec: pace3.value,
        pace5Sec: pace5.value,
        currentStint: {
          index: 1,
          compound: driver.compound,
          startLap: driver.stintStart,
          endLap: null,
          tyreAgeAtStart: 0,
          currentAgeLaps: currentLap - driver.stintStart + 1
        },
        stints: [
          { index: 0, compound: 'HARD', startLap: 1, endLap: driver.pitLap, tyreAgeAtStart: 0, currentAgeLaps: driver.pitLap },
          { index: 1, compound: driver.compound, startLap: driver.stintStart, endLap: null, tyreAgeAtStart: 0, currentAgeLaps: currentLap - driver.stintStart + 1 }
        ],
        laps
      });
    });
    const snapshot: SessionSnapshot = {
      id: source.id,
      meetingId: source.meetingId,
      kind: source.kind,
      phase: source.phase,
      segment: source.segment,
      startedAt: source.startedAt,
      endsAt: source.endsAt,
      clockSeconds: source.clockSeconds,
      lap: source.lap,
      totalLaps: source.totalLaps,
      trackStatus: source.trackStatus,
      drivers,
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
        sourceUpdatedAt: source.sourceUpdatedAt,
        ingestedAt: this.clock.now().toISOString(),
        stale: false,
        ageSeconds: 0
      }
    };
    return this.events.filter((event) => event.atMs <= atMs).reduce(applyReplayEvent, snapshot);
  }
}

function applyReplayEvent(snapshot: SessionSnapshot, event: ReplayEvent): SessionSnapshot {
  const common = {
    ...snapshot,
    revision: snapshot.revision + 1,
    meta: {
      ...snapshot.meta,
      sourceUpdatedAt: new Date(Date.parse(snapshot.meta.sourceUpdatedAt ?? snapshot.meta.ingestedAt) + event.atMs).toISOString()
    }
  };
  if (event.type === 'gap') {
    return {
      ...common,
      drivers: common.drivers.map((driver) => driver.number === event.payload.driverNumber
        ? { ...driver, gapToLeaderSec: event.payload.gap, intervalAheadSec: event.payload.interval }
        : driver)
    };
  }
  if (event.type === 'status') {
    return {
      ...common,
      trackStatus: event.payload.trackStatus,
      raceControl: [...common.raceControl, event.payload.raceControl]
    };
  }
  return {
    ...common,
    phase: event.payload.phase,
    trackStatus: event.payload.trackStatus ?? common.trackStatus,
    lap: event.payload.lap ?? common.lap,
    endsAt: event.payload.endsAt === undefined ? common.endsAt : event.payload.endsAt
  };
}
