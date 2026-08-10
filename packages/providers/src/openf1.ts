import type {
  Clock,
  DateRange,
  DriverState,
  Lap,
  Meeting,
  RaceControlEvent,
  SessionKind,
  SessionPhase,
  SessionSnapshot,
  SessionSummary,
  Stint,
  TrackStatusCode,
  TyreCompound
} from '@f1/domain';
import { calculatePace, markCleanLaps, sessionSnapshotSchema } from '@f1/domain';
import { z } from 'zod';
import type { ProviderUpdateBatch, TimingProvider } from './types';
import { ProviderError } from './types';

const rawArraySchema = z.array(z.record(z.string(), z.unknown()));
const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().positive().default(3600) });
const compounds = new Set<TyreCompound>(['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET', 'TEST_UNKNOWN']);

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
type RawRecord = Record<string, unknown>;

export interface OpenF1AdapterOptions {
  baseUrl: string;
  clock: Clock;
  fetcher?: Fetcher;
  username?: string;
  password?: string;
  accessToken?: string;
  requestIntervalMs?: number;
}

export class OpenF1Adapter implements TimingProvider {
  readonly name = 'openf1';
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly requestIntervalMs: number;
  private token: { value: string; expiresAt: number } | null;
  private tokenRequest: Promise<string> | null = null;
  private requestQueue: Promise<void> = Promise.resolve();
  private nextRequestAt = 0;

  constructor(private readonly options: OpenF1AdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/u, '');
    this.fetcher = options.fetcher ?? fetch;
    this.requestIntervalMs = options.requestIntervalMs ?? 400;
    this.token = options.accessToken ? { value: options.accessToken, expiresAt: Number.POSITIVE_INFINITY } : null;
  }

  capabilities() {
    return {
      gaps: true,
      sectors: true,
      stints: true,
      raceControl: true,
      weather: true,
      physicalOrder: false,
      drsStatus: false,
      finalClassification: false,
      livePush: false
    } as const;
  }

  async getMeetings(range: DateRange): Promise<Meeting[]> {
    const year = new Date(range.from).getUTCFullYear();
    const meetings = await this.fetchArray('meetings', { year: String(year) });
    const withinRange = meetings.filter((meeting) => {
      const startsAt = text(meeting.date_start);
      return startsAt !== null && startsAt >= range.from && startsAt <= range.to;
    });
    const normalized = await Promise.all(withinRange.map(async (meeting) => {
      const key = integer(meeting.meeting_key);
      if (key === null) return null;
      const sessions = await this.getSessions(`meeting:openf1:${key}`);
      return normalizeMeeting(meeting, sessions);
    }));
    const sorted = normalized.filter((meeting): meeting is Meeting => meeting !== null).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return sorted.map((meeting, index) => {
      const next = sorted[index + 1];
      return next ? { ...meeting, nextMeeting: { id: next.id, name: next.name, startsAt: next.startsAt } } : meeting;
    });
  }

  async getSessions(meetingId: string): Promise<SessionSummary[]> {
    const meetingKey = providerKey(meetingId, 'meeting');
    const sessions = await this.fetchArray('sessions', { meeting_key: meetingKey });
    return sessions.flatMap((session) => {
      const normalized = normalizeSession(session, this.options.clock.now());
      return normalized ? [normalized] : [];
    });
  }

  async getSessionSnapshot(sessionId: string): Promise<SessionSnapshot> {
    const sessionKey = providerKey(sessionId, 'session');
    const query = { session_key: sessionKey };
    const [sessions, drivers, positions, intervals, laps, stints, pits, raceControl, results] = await Promise.all([
      this.fetchArray('sessions', query),
      this.fetchArray('drivers', query),
      this.fetchArray('position', query),
      this.fetchArray('intervals', query),
      this.fetchArray('laps', query),
      this.fetchArray('stints', query),
      this.fetchArray('pit', query),
      this.fetchArray('race_control', query),
      this.fetchArray('session_result', query)
    ]);
    const session = sessions[0];
    if (!session) throw new ProviderError(`OpenF1 session not found: ${sessionKey}`, 'SESSION_NOT_FOUND', false, 404);
    return normalizeSnapshot({
      sessionId,
      session,
      drivers,
      positions,
      intervals,
      laps,
      stints,
      pits,
      raceControl,
      results,
      now: this.options.clock.now()
    });
  }

  async getHistoricalSession(sessionId: string): Promise<SessionSnapshot> {
    return this.getSessionSnapshot(sessionId);
  }

  async getUpdates(sessionId: string, since?: string): Promise<ProviderUpdateBatch> {
    const snapshot = await this.getSessionSnapshot(sessionId);
    const cursor = String(snapshot.revision);
    return { updates: since === cursor ? [] : [{ cursor, snapshot }], nextCursor: cursor };
  }

  private async fetchArray(endpoint: string, query: Record<string, string>): Promise<RawRecord[]> {
    const search = new URLSearchParams(query);
    const response = await this.request(`${this.baseUrl}/${endpoint}?${search}`);
    try {
      return rawArraySchema.parse(await response.json());
    } catch {
      throw new ProviderError(`OpenF1 returned malformed ${endpoint} data`, 'INVALID_PROVIDER_RESPONSE', false, 502);
    }
  }

  private async request(url: string): Promise<Response> {
    const token = await this.getAccessToken();
    const headers = new Headers({ Accept: 'application/json' });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.waitForRequestSlot();
      let response: Response;
      try {
        response = await this.fetcher(url, { headers, signal: AbortSignal.timeout(8_000) });
      } catch {
        throw new ProviderError('OpenF1 request timed out or could not connect', 'PROVIDER_NETWORK_ERROR', true, 503);
      }
      if (response.ok) return response;
      const status = response.status;
      if (status === 429 && attempt < 2) {
        await sleep(retryDelayMs(response.headers.get('Retry-After'), attempt));
        continue;
      }
      throw new ProviderError(
        status === 429 ? 'OpenF1 rate limit reached' : `OpenF1 request failed (${status})`,
        status === 429 ? 'PROVIDER_RATE_LIMITED' : 'PROVIDER_ERROR',
        status === 429 || status >= 500,
        status
      );
    }
    throw new ProviderError('OpenF1 rate limit reached', 'PROVIDER_RATE_LIMITED', true, 429);
  }

  private async waitForRequestSlot(): Promise<void> {
    let release: () => void = () => {};
    const previous = this.requestQueue;
    this.requestQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const waitMs = Math.max(0, this.nextRequestAt - Date.now());
    if (waitMs > 0) await sleep(waitMs);
    this.nextRequestAt = Date.now() + this.requestIntervalMs;
    release();
  }

  private async getAccessToken(): Promise<string | null> {
    const now = this.options.clock.now().getTime();
    if (this.token && this.token.expiresAt - 30_000 > now) return this.token.value;
    const { username, password } = this.options;
    if (!username || !password) return null;
    if (!this.tokenRequest) {
      this.tokenRequest = this.authenticate(now, username, password).finally(() => {
        this.tokenRequest = null;
      });
    }
    return this.tokenRequest;
  }

  private async authenticate(now: number, username: string, password: string): Promise<string> {
    const tokenUrl = `${this.baseUrl.replace(/\/v1$/u, '')}/token`;
    const body = new URLSearchParams({ username, password });
    let response: Response;
    try {
      response = await this.fetcher(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(8_000)
      });
    } catch {
      throw new ProviderError('OpenF1 authentication could not connect', 'PROVIDER_AUTH_ERROR', true, 503);
    }
    if (!response.ok) throw new ProviderError('OpenF1 authentication failed', 'PROVIDER_AUTH_ERROR', false, 502);
    const parsed = tokenSchema.safeParse(await response.json());
    if (!parsed.success) throw new ProviderError('OpenF1 authentication returned an invalid token', 'PROVIDER_AUTH_ERROR', false, 502);
    this.token = { value: parsed.data.access_token, expiresAt: now + parsed.data.expires_in * 1_000 };
    return this.token.value;
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelayMs(retryAfter: string | null, attempt: number): number {
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  }
  return 1_000 * (attempt + 1);
}

function providerKey(id: string, entity: 'meeting' | 'session'): string {
  const match = new RegExp(`^${entity}:openf1:(\\d+)$`, 'u').exec(id);
  if (!match?.[1]) throw new ProviderError(`Invalid ${entity} ID`, 'INVALID_PROVIDER_ID', false, 400);
  return match[1];
}

function normalizeMeeting(raw: RawRecord, sessions: SessionSummary[]): Meeting | null {
  const key = integer(raw.meeting_key);
  const startsAt = iso(raw.date_start);
  const endsAt = iso(raw.date_end);
  if (key === null || !startsAt || !endsAt) return null;
  const circuitName = text(raw.circuit_short_name) ?? text(raw.location) ?? 'Circuit unavailable';
  return {
    id: `meeting:openf1:${key}`,
    name: text(raw.meeting_name) ?? text(raw.meeting_official_name) ?? 'Grand Prix',
    countryCode: (text(raw.country_code) ?? 'UNK').slice(0, 3).toUpperCase(),
    circuitId: `track:openf1:${integer(raw.circuit_key) ?? slug(circuitName)}`,
    circuitName,
    startsAt,
    endsAt,
    sessions
  };
}

function normalizeSession(raw: RawRecord, now: Date): SessionSummary | null {
  const key = integer(raw.session_key);
  const startsAt = iso(raw.date_start);
  if (key === null || !startsAt) return null;
  const name = text(raw.session_name) ?? text(raw.session_type) ?? 'Session';
  const kind = sessionKind(name);
  if (!kind) return null;
  const endsAt = iso(raw.date_end);
  return { id: `session:openf1:${key}`, name, kind, startsAt, endsAt, phase: phaseFromTime(startsAt, endsAt, now) };
}

interface SnapshotInput {
  sessionId: string;
  session: RawRecord;
  drivers: RawRecord[];
  positions: RawRecord[];
  intervals: RawRecord[];
  laps: RawRecord[];
  stints: RawRecord[];
  pits: RawRecord[];
  raceControl: RawRecord[];
  results: RawRecord[];
  now: Date;
}

function normalizeSnapshot(input: SnapshotInput): SessionSnapshot {
  const meetingKey = integer(input.session.meeting_key);
  const name = text(input.session.session_name) ?? text(input.session.session_type) ?? 'Race';
  const kind = sessionKind(name) ?? 'race';
  const raceControl = normalizeRaceControl(input.raceControl);
  const currentTrackStatus = trackStatusFromEvents(raceControl);
  const currentLap = Math.max(0, ...input.laps.map((lap) => integer(lap.lap_number) ?? 0));
  const positions = latestByDriver(input.positions);
  const intervals = latestByDriver(input.intervals);
  const results = latestByDriver(input.results);
  const pitLaps = new Set(input.pits.map((pit) => `${integer(pit.driver_number)}:${integer(pit.lap_number)}`));
  const drivers = input.drivers.flatMap((rawDriver) => {
    const driver = normalizeDriver(rawDriver, {
      kind,
      year: new Date(iso(input.session.date_start) ?? input.now).getUTCFullYear(),
      currentLap,
      position: positions.get(integer(rawDriver.driver_number) ?? -1),
      interval: intervals.get(integer(rawDriver.driver_number) ?? -1),
      result: results.get(integer(rawDriver.driver_number) ?? -1),
      laps: input.laps,
      stints: input.stints,
      pitLaps,
      raceControl: input.raceControl
    });
    return driver ? [driver] : [];
  }).sort((left, right) => (left.position ?? 99) - (right.position ?? 99));
  const sourceUpdatedAt = latestTimestamp([
    ...input.positions, ...input.intervals, ...input.laps, ...input.raceControl
  ]) ?? iso(input.session.date_start) ?? input.now.toISOString();
  const hasResults = input.results.length > 0;
  let phase: SessionPhase = hasResults ? 'finished_provisional' : phaseFromTime(iso(input.session.date_start), iso(input.session.date_end), input.now);
  if (currentTrackStatus === 'RED' && phase === 'live') phase = 'suspended';
  const historical = ['finished_provisional', 'finished_final'].includes(phase);
  const ageSeconds = historical ? 0 : Math.max(0, (input.now.getTime() - Date.parse(sourceUpdatedAt)) / 1_000);
  const revision = Math.max(1, Math.floor(Date.parse(sourceUpdatedAt) / 1_000));
  return sessionSnapshotSchema.parse({
    id: input.sessionId,
    meetingId: `meeting:openf1:${meetingKey ?? 'unknown'}`,
    kind,
    phase,
    segment: qualifyingSegment(name),
    startedAt: iso(input.session.date_start),
    endsAt: hasResults ? iso(input.session.date_end) : null,
    clockSeconds: null,
    lap: currentLap || null,
    totalLaps: integer(input.session.number_of_laps),
    trackStatus: { code: currentTrackStatus, label: trackStatusLabel(currentTrackStatus) },
    drivers,
    raceControl,
    battles: [],
    pitProjections: [],
    strategySignals: [],
    insights: [],
    revision,
    requestedDelaySeconds: 0,
    effectiveDelaySeconds: 0,
    meta: { provider: 'openf1', sourceUpdatedAt, ingestedAt: input.now.toISOString(), stale: ageSeconds > 15, ageSeconds }
  });
}

interface DriverInput {
  kind: SessionKind;
  year: number;
  currentLap: number;
  position?: RawRecord | undefined;
  interval?: RawRecord | undefined;
  result?: RawRecord | undefined;
  laps: RawRecord[];
  stints: RawRecord[];
  pitLaps: Set<string>;
  raceControl: RawRecord[];
}

function normalizeDriver(raw: RawRecord, input: DriverInput): DriverState | null {
  const number = integer(raw.driver_number);
  if (number === null) return null;
  const rawStints = input.stints.filter((stint) => integer(stint.driver_number) === number);
  const stints = rawStints.flatMap((stint) => {
    const normalized = normalizeStint(stint, input.currentLap);
    return normalized ? [normalized] : [];
  }).sort((left, right) => left.index - right.index);
  const rawLaps = input.laps.filter((lap) => integer(lap.driver_number) === number);
  const laps: Lap[] = markCleanLaps(rawLaps.flatMap((lap) => {
    const normalized = normalizeLap(lap, stints, input.pitLaps, input.raceControl);
    return normalized ? [normalized] : [];
  }).sort((left, right) => left.lapNumber - right.lapNumber), input.kind);
  const pace3 = calculatePace(laps, 3);
  const pace5 = calculatePace(laps, 5);
  const timedLaps = laps.filter((lap) => lap.timeSec !== null);
  const resultStatus = boolean(input.result?.dnf) ? 'retired' : boolean(input.result?.dns) ? 'dns' : input.result ? 'finished' : 'running';
  const currentStint = [...stints].reverse().find((stint) => stint.endLap === null) ?? null;
  return {
    driverId: `driver:${number}:${input.year}`,
    number,
    code: text(raw.name_acronym) ?? String(number),
    fullName: text(raw.full_name) ?? text(raw.broadcast_name) ?? `Driver ${number}`,
    teamName: text(raw.team_name) ?? 'Team unavailable',
    teamColor: normalizeColor(text(raw.team_colour)),
    position: integer(input.position?.position) ?? integer(input.result?.position),
    status: resultStatus,
    gapToLeaderSec: numeric(input.interval?.gap_to_leader),
    intervalAheadSec: numeric(input.interval?.interval),
    lastLapSec: timedLaps.at(-1)?.timeSec ?? null,
    bestLapSec: timedLaps.length ? Math.min(...timedLaps.map((lap) => lap.timeSec as number)) : null,
    pace3Sec: pace3.value,
    pace5Sec: pace5.value,
    currentStint,
    stints,
    laps
  };
}

function normalizeLap(raw: RawRecord, stints: Stint[], pitLaps: Set<string>, raceControl: RawRecord[]): Lap | null {
  const lapNumber = integer(raw.lap_number);
  const driverNumber = integer(raw.driver_number);
  if (lapNumber === null || driverNumber === null) return null;
  const startedAt = iso(raw.date_start);
  const stint = stints.find((candidate) => candidate.startLap <= lapNumber && (candidate.endLap === null || candidate.endLap >= lapNumber));
  return {
    lapNumber,
    timeSec: numeric(raw.lap_duration),
    sectorsSec: [numeric(raw.duration_sector_1), numeric(raw.duration_sector_2), numeric(raw.duration_sector_3)],
    startedAt,
    compound: stint?.compound ?? null,
    isPitIn: pitLaps.has(`${driverNumber}:${lapNumber}`),
    isPitOut: boolean(raw.is_pit_out_lap),
    trackStatus: startedAt ? trackStatusAt(startedAt, raceControl) : 'UNKNOWN',
    clean: false,
    exclusionReasons: []
  };
}

function normalizeStint(raw: RawRecord, currentLap: number): Stint | null {
  const startLap = integer(raw.lap_start);
  if (startLap === null) return null;
  const endLap = integer(raw.lap_end);
  const tyreAgeAtStart = integer(raw.tyre_age_at_start);
  return {
    index: Math.max(0, (integer(raw.stint_number) ?? 1) - 1),
    compound: normalizeCompound(text(raw.compound)),
    startLap,
    endLap,
    tyreAgeAtStart,
    currentAgeLaps: endLap === null ? Math.max(1, currentLap - startLap + 1 + (tyreAgeAtStart ?? 0)) : null
  };
}

function normalizeRaceControl(rawEvents: RawRecord[]): RaceControlEvent[] {
  return rawEvents.flatMap((raw, index) => {
    const occurredAt = iso(raw.date);
    if (!occurredAt) return [];
    const message = text(raw.message) ?? '';
    const categoryText = (text(raw.category) ?? 'message').toLowerCase();
    const category: RaceControlEvent['category'] = categoryText.includes('safety')
      ? 'safety_car'
      : categoryText.includes('flag')
        ? 'flag'
        : message.toLowerCase().includes('penalty')
          ? 'penalty'
          : message.toLowerCase().includes('investigation')
            ? 'investigation'
            : message.toLowerCase().includes('incident')
              ? 'incident'
              : 'message';
    const priority = /RED FLAG|SAFETY CAR|VIRTUAL SAFETY CAR|PENALTY/iu.test(message) ? 'high' : 'normal';
    const driverNumber = integer(raw.driver_number);
    return [{
      id: `rc:openf1:${occurredAt}:${index}`,
      occurredAt,
      category,
      priority,
      sourceText: message,
      label: deterministicRaceControlLabel(message, text(raw.flag)),
      driverIds: driverNumber === null ? [] : [`driver:${driverNumber}:${new Date(occurredAt).getUTCFullYear()}`]
    } satisfies RaceControlEvent];
  }).sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

function latestByDriver(records: RawRecord[]): Map<number, RawRecord> {
  const result = new Map<number, RawRecord>();
  for (const record of records) {
    const driverNumber = integer(record.driver_number);
    if (driverNumber !== null) result.set(driverNumber, record);
  }
  return result;
}

function phaseFromTime(startsAt: string | null, endsAt: string | null, now: Date): SessionPhase {
  if (!startsAt) return 'unavailable';
  const nowMs = now.getTime();
  if (nowMs < Date.parse(startsAt) - 30 * 60_000) return 'scheduled';
  if (nowMs < Date.parse(startsAt)) return 'pre_live';
  if (endsAt && nowMs > Date.parse(endsAt)) return 'finishing';
  return 'live';
}

function sessionKind(name: string): SessionKind | null {
  const normalized = name.toLowerCase();
  if (normalized.includes('sprint qualifying') || normalized.includes('shootout') || normalized.includes('qualifying')) return 'qualifying';
  if (normalized.includes('practice')) return 'practice';
  if (normalized.includes('sprint')) return 'sprint';
  if (normalized.includes('race')) return 'race';
  return null;
}

function qualifyingSegment(name: string): 'Q1' | 'Q2' | 'Q3' | null {
  const match = /\b(Q[123])\b/u.exec(name.toUpperCase());
  return match?.[1] as 'Q1' | 'Q2' | 'Q3' | undefined ?? null;
}

function trackStatusAt(at: string, events: RawRecord[]): TrackStatusCode {
  let status: TrackStatusCode = 'GREEN';
  for (const event of events) {
    const date = iso(event.date);
    if (!date || date > at) continue;
    status = trackStatusFromText(`${text(event.flag) ?? ''} ${text(event.message) ?? ''}`);
  }
  return status;
}

function trackStatusFromEvents(events: RaceControlEvent[]): TrackStatusCode {
  return events.length ? trackStatusFromText(events.at(-1)?.sourceText ?? '') : 'GREEN';
}

function trackStatusFromText(value: string): TrackStatusCode {
  const textValue = value.toUpperCase();
  if (textValue.includes('RED FLAG')) return 'RED';
  if (textValue.includes('VIRTUAL SAFETY CAR') && !textValue.includes('ENDING')) return 'VSC';
  if (textValue.includes('SAFETY CAR') && !textValue.includes('ENDING')) return 'SC';
  if (textValue.includes('YELLOW')) return 'YELLOW';
  if (textValue.includes('CHEQUERED')) return 'CHEQUERED';
  return 'GREEN';
}

function trackStatusLabel(code: TrackStatusCode): string {
  return ({ GREEN: 'Green flag', YELLOW: 'Yellow flag', SC: 'Safety Car', VSC: 'Virtual Safety Car', RED: 'Red flag', CHEQUERED: 'Chequered flag', UNKNOWN: 'Status unavailable' })[code];
}

function deterministicRaceControlLabel(message: string, flag: string | null): string | null {
  const combined = `${flag ?? ''} ${message}`.toUpperCase();
  if (combined.includes('RED FLAG')) return 'Red flag';
  if (combined.includes('VIRTUAL SAFETY CAR')) return 'Virtual Safety Car';
  if (combined.includes('SAFETY CAR')) return 'Safety Car';
  if (combined.includes('GREEN')) return 'Green flag';
  if (combined.includes('PENALTY')) return 'Penalty';
  return null;
}

function latestTimestamp(records: RawRecord[]): string | null {
  return records.reduce<string | null>((latest, record) => {
    const candidate = iso(record.date) ?? iso(record.date_start);
    return candidate && (!latest || candidate > latest) ? candidate : latest;
  }, null);
}

function normalizeColor(value: string | null): string | null {
  if (!value) return null;
  return /^#?[0-9A-F]{6}$/iu.test(value) ? `#${value.replace('#', '').toUpperCase()}` : null;
}

function normalizeCompound(value: string | null): TyreCompound | null {
  const normalized = value?.toUpperCase() as TyreCompound | undefined;
  return normalized && compounds.has(normalized) ? normalized : null;
}

function numeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/u.test(value.trim())) return Number(value);
  return null;
}

function integer(value: unknown): number | null {
  const parsed = numeric(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function iso(value: unknown): string | null {
  const valueText = text(value);
  if (!valueText || Number.isNaN(Date.parse(valueText))) return null;
  return new Date(valueText).toISOString();
}

function boolean(value: unknown): boolean {
  return value === true || value === 1 || value === 'true';
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/(^-|-$)/gu, '');
}
