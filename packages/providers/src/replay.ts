import { readFile } from 'node:fs/promises';
import type { Clock, Meeting, SessionSnapshot, SessionSummary, Track } from '@f1/domain';
import {
  meetingSchema,
  raceControlEventSchema,
  sessionSnapshotSchema,
  trackSchema,
  trackStatusSchema
} from '@f1/domain';
import { z } from 'zod';
import type { ProviderUpdateBatch, TimingProvider } from './types';
import { ProviderError } from './types';

const replayFixtureSchema = z.object({
  schemaVersion: z.literal(2),
  provenance: z.object({
    provider: z.literal('OpenF1'),
    sessionKey: z.number().int().positive(),
    sourceUrl: z.string().url(),
    generatedAt: z.iso.datetime()
  }),
  meeting: meetingSchema,
  track: trackSchema,
  session: z.object({
    initialSnapshot: sessionSnapshotSchema,
    finalSnapshot: sessionSnapshotSchema
  })
});

const replayEventSchema = z.discriminatedUnion('type', [
  z.object({
    atMs: z.number().int().nonnegative(),
    sourceUpdatedAt: z.iso.datetime(),
    type: z.literal('status'),
    payload: z.object({
      trackStatus: trackStatusSchema,
      lap: z.number().int().nonnegative(),
      raceControl: raceControlEventSchema
    })
  }),
  z.object({
    atMs: z.number().int().nonnegative(),
    sourceUpdatedAt: z.iso.datetime().nullable(),
    type: z.literal('final'),
    payload: z.object({})
  })
]);

type ReplayFixture = z.infer<typeof replayFixtureSchema>;
type ReplayEvent = z.infer<typeof replayEventSchema>;
type StatusReplayEvent = Extract<ReplayEvent, { type: 'status' }>;
interface ReplayData { fixture: ReplayFixture; events: ReplayEvent[] }

const replayDataPromises = new Map<string, Promise<ReplayData>>();

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
    const key = `${options.fixturePath}\u0000${options.eventsPath}`;
    const cached = replayDataPromises.get(key) ?? loadReplayData(options.fixturePath, options.eventsPath);
    replayDataPromises.set(key, cached);
    const { fixture, events } = await cached.catch((error: unknown) => {
      replayDataPromises.delete(key);
      throw error;
    });
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
      finalClassification: true,
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
    return this.createSnapshot(this.elapsedMs());
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
    if (sessionId !== this.fixture.session.initialSnapshot.id) {
      throw new ProviderError(`Replay session not found: ${sessionId}`, 'SESSION_NOT_FOUND', false, 404);
    }
  }

  private createSnapshot(atMs: number): SessionSnapshot {
    let snapshot = this.asReplaySnapshot(this.fixture.session.initialSnapshot);
    for (const event of this.events) {
      if (event.atMs > atMs) break;
      snapshot = event.type === 'final'
        ? this.asReplaySnapshot(this.fixture.session.finalSnapshot, snapshot.revision + 1)
        : applyStatusEvent(snapshot, event);
    }
    return sessionSnapshotSchema.parse(snapshot);
  }

  private asReplaySnapshot(source: SessionSnapshot, revision = source.revision): SessionSnapshot {
    return {
      ...structuredClone(source),
      revision,
      requestedDelaySeconds: 0,
      effectiveDelaySeconds: 0,
      meta: {
        ...source.meta,
        provider: 'replay:openf1',
        ingestedAt: this.clock.now().toISOString(),
        stale: false,
        ageSeconds: 0
      }
    };
  }
}

async function loadReplayData(fixturePath: string, eventsPath: string): Promise<ReplayData> {
  const [fixtureText, eventText] = await Promise.all([
    readFile(fixturePath, 'utf8'),
    readFile(eventsPath, 'utf8')
  ]);
  const fixture = replayFixtureSchema.parse(JSON.parse(fixtureText));
  const events = eventText
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => replayEventSchema.parse(JSON.parse(line)))
    .sort((left, right) => left.atMs - right.atMs);
  return { fixture, events };
}

function applyStatusEvent(snapshot: SessionSnapshot, event: StatusReplayEvent): SessionSnapshot {
  return {
    ...snapshot,
    lap: event.payload.lap,
    trackStatus: event.payload.trackStatus,
    raceControl: [...snapshot.raceControl, event.payload.raceControl],
    revision: snapshot.revision + 1,
    meta: { ...snapshot.meta, sourceUpdatedAt: event.sourceUpdatedAt }
  };
}
