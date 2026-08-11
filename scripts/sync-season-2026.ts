import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FakeClock, seasonCatalogSchema, type SeasonCatalog, type SessionSnapshot } from '@f1/domain';
import { OpenF1Adapter } from '@f1/providers';

const season = 2026;
const meetingKey = 1291;
const sessionKey = 11342;
const replayLap = 43;
const apiBaseUrl = process.env.OPENF1_BASE_URL ?? 'https://api.openf1.org/v1';
const fixtureDirectory = resolve(process.cwd(), 'fixtures');
const approvedCircuitImageOverrides = new Map<number, string>([
  [15, 'https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Spain%20carbon.png']
]);
// OpenF1 currently reuses Catalunya for Madring and Sakhir for the Sepang replacement.
const rejectedCircuitImageAssociations = new Set([12, 153]);

type RawRecord = Record<string, unknown>;
type EndpointData = Map<string, RawRecord[]>;

async function main(): Promise<void> {
  const endpointData = await loadSessionData();
  const meetings = await fetchArray(`meetings?year=${season}`);
  const meetingSessions = await fetchArray(`sessions?meeting_key=${meetingKey}`);
  const catalog = await buildCatalog(meetings, endpointData.get('drivers') ?? []);
  const finalSnapshot = await normalizeSnapshot(endpointData, 'final');
  const initialSnapshot = await normalizeSnapshot(endpointData, 'initial');
  const fixture = await buildReplayFixture(catalog, meetings, meetingSessions, initialSnapshot, finalSnapshot);
  const events = buildReplayEvents(finalSnapshot);

  await Promise.all([
    writeJson('season-2026.json', seasonCatalogSchema.parse(catalog)),
    writeJson('2026-hungary-race.json', fixture),
    writeFile(resolve(fixtureDirectory, '2026-hungary-race.ndjson'), `${events.map((event) => JSON.stringify(event)).join('\n')}\n`, 'utf8'),
    writeJson('manifest.json', {
      schemaVersion: 1,
      sessions: [{
        id: 'session:replay:hungary-race-2026',
        name: 'Hungarian Grand Prix',
        kind: 'race',
        fixture: '2026-hungary-race.json',
        events: '2026-hungary-race.ndjson',
        durationMs: 5000
      }]
    })
  ]);
}

async function loadSessionData(): Promise<EndpointData> {
  const endpoints = ['sessions', 'drivers', 'position', 'intervals', 'laps', 'stints', 'pit', 'race_control', 'session_result'];
  const entries: [string, RawRecord[]][] = [];
  for (const endpoint of endpoints) {
    entries.push([endpoint, await fetchArray(`${endpoint}?session_key=${sessionKey}`)]);
    await sleep(450);
  }
  return new Map(entries);
}

async function normalizeSnapshot(endpointData: EndpointData, mode: 'initial' | 'final'): Promise<SessionSnapshot> {
  const cutoff = replayCutoff(endpointData.get('laps') ?? [], endpointData.get('session_result') ?? []);
  const filtered = mode === 'initial' ? filterAtCutoff(endpointData, cutoff) : endpointData;
  const now = mode === 'initial' ? new Date(cutoff) : new Date('2026-07-26T16:00:00.000Z');
  const adapter = new OpenF1Adapter({
    baseUrl: apiBaseUrl,
    clock: new FakeClock(now),
    requestIntervalMs: 0,
    fetcher: async (input) => {
      const endpoint = new URL(input).pathname.split('/').at(-1) ?? '';
      return Response.json(filtered.get(endpoint) ?? []);
    }
  });
  const snapshot = await adapter.getHistoricalSession(`session:openf1:${sessionKey}`);
  return {
    ...snapshot,
    id: 'session:replay:hungary-race-2026',
    meetingId: 'meeting:replay:hungary-2026',
    phase: mode === 'initial' ? 'live' : 'finished_provisional',
    lap: mode === 'initial' ? replayLap : 70,
    totalLaps: 70,
    endsAt: mode === 'initial' ? null : snapshot.endsAt,
    drivers: snapshot.drivers.map((driver) => ({ ...driver, laps: driver.laps.slice(-12) })),
    meta: { ...snapshot.meta, stale: false, ageSeconds: 0 }
  };
}

function filterAtCutoff(endpointData: EndpointData, cutoff: string): EndpointData {
  const filtered = new Map<string, RawRecord[]>();
  for (const [endpoint, records] of endpointData) {
    filtered.set(endpoint, filterEndpoint(endpoint, records, cutoff));
  }
  return filtered;
}

function filterEndpoint(endpoint: string, records: RawRecord[], cutoff: string): RawRecord[] {
  if (endpoint === 'session_result') return records.filter((record) => number(record.number_of_laps) < replayLap);
  if (endpoint === 'laps') return records.filter((record) => number(record.lap_number) <= replayLap);
  if (endpoint === 'stints') {
    return records
      .filter((record) => number(record.lap_start) <= replayLap)
      .map((record) => number(record.lap_end) > replayLap ? { ...record, lap_end: null } : record);
  }
  if (['position', 'intervals', 'pit', 'race_control'].includes(endpoint)) {
    return records.filter((record) => timestamp(record.date) <= timestamp(cutoff));
  }
  return records;
}

function replayCutoff(laps: RawRecord[], results: RawRecord[]): string {
  const leader = results.find((result) => number(result.position) === 1);
  const leaderNumber = number(leader?.driver_number);
  const firstNextLap = laps.find((lap) => number(lap.driver_number) === leaderNumber && number(lap.lap_number) === replayLap + 1);
  const cutoff = string(firstNextLap?.date_start);
  if (!cutoff) throw new Error(`OpenF1 has no lap ${replayLap + 1} cutoff for session ${sessionKey}`);
  return new Date(cutoff).toISOString();
}

async function buildCatalog(meetings: RawRecord[], rawDrivers: RawRecord[]): Promise<SeasonCatalog> {
  const generatedAt = new Date().toISOString();
  const grandPrixMeetings = meetings.filter((meeting) => !/testing/iu.test(string(meeting.meeting_name) ?? ''));
  const drivers = rawDrivers.map((driver) => {
    const driverNumber = number(driver.driver_number);
    const teamName = requiredString(driver.team_name);
    const firstName = titleCase(requiredString(driver.first_name));
    const lastName = titleCase(requiredString(driver.last_name));
    return {
      id: `driver:${driverNumber}:${season}`,
      number: driverNumber,
      code: requiredString(driver.name_acronym),
      fullName: `${firstName} ${lastName}`,
      firstName,
      lastName,
      countryCode: string(driver.country_code)?.slice(0, 3).toUpperCase() ?? null,
      teamId: teamId(teamName),
      teamName,
      teamColor: color(driver.team_colour)
    };
  }).sort((left, right) => left.number - right.number);
  const teamsById = new Map<string, { id: string; name: string; color: string; driverIds: string[] }>();
  for (const driver of drivers) {
    const team = teamsById.get(driver.teamId) ?? { id: driver.teamId, name: driver.teamName, color: driver.teamColor, driverIds: [] };
    team.driverIds.push(driver.id);
    teamsById.set(driver.teamId, team);
  }
  const circuitsByKey = new Map<number, RawRecord>();
  for (const meeting of grandPrixMeetings) circuitsByKey.set(number(meeting.circuit_key), meeting);
  const now = Date.now();
  const circuits: Record<string, unknown>[] = [];
  for (const meeting of circuitsByKey.values()) {
    const key = number(meeting.circuit_key);
    const upstreamImageUrl = formulaOneImage(meeting.circuit_image);
    const layoutImageUrl = approvedCircuitImageOverrides.get(key) ?? upstreamImageUrl;
    const associationAccepted = !rejectedCircuitImageAssociations.has(key);
    const verified = associationAccepted && await verifyFormulaOneImage(layoutImageUrl);
    circuits.push({
      id: circuitId(key),
      circuitKey: key,
      name: requiredString(meeting.circuit_short_name),
      location: requiredString(meeting.location),
      countryCode: requiredString(meeting.country_code).toUpperCase(),
      countryName: requiredString(meeting.country_name),
      type: normalizeCircuitType(string(meeting.circuit_type)),
      upstreamImageUrl,
      layoutImageUrl: verified ? layoutImageUrl : null,
      layoutSourceUrl: associationAccepted ? layoutImageUrl : null,
      layoutStatus: verified ? 'verified' : 'unavailable',
      layoutVerifiedAt: verified ? generatedAt : null
    });
    await sleep(100);
  }
  return seasonCatalogSchema.parse({
    schemaVersion: 1,
    season,
    generatedAt,
    sources: [
      { name: 'Formula 1 2026 calendar', url: 'https://www.formula1.com/en/racing/2026', role: 'calendar' },
      { name: 'FIA 2026 entry list', url: 'https://www.fia.com/events/fia-formula-one-world-championship/season-2026/2026-fia-formula-one-world-championship-entry', role: 'entry_list' },
      { name: 'OpenF1 historical data', url: 'https://openf1.org/docs/', role: 'telemetry' },
      { name: 'Formula 1 circuit media', url: 'https://media.formula1.com/', role: 'circuit_image' }
    ],
    events: grandPrixMeetings.map((meeting) => {
      const endsAt = iso(meeting.date_end);
      return {
        id: `meeting:openf1:${number(meeting.meeting_key)}`,
        meetingKey: number(meeting.meeting_key),
        name: requiredString(meeting.meeting_name),
        officialName: string(meeting.meeting_official_name) ?? requiredString(meeting.meeting_name),
        circuitId: circuitId(number(meeting.circuit_key)),
        startsAt: iso(meeting.date_start),
        endsAt,
        status: boolean(meeting.is_cancelled) ? 'cancelled' : timestamp(endsAt) < now ? 'completed' : 'scheduled'
      };
    }).sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    circuits,
    drivers,
    teams: [...teamsById.values()].sort((left, right) => left.name.localeCompare(right.name))
  });
}

async function buildReplayFixture(
  catalog: SeasonCatalog,
  meetings: RawRecord[],
  sessions: RawRecord[],
  initialSnapshot: SessionSnapshot,
  finalSnapshot: SessionSnapshot
): Promise<Record<string, unknown>> {
  const meeting = meetings.find((candidate) => number(candidate.meeting_key) === meetingKey);
  if (!meeting) throw new Error(`OpenF1 meeting ${meetingKey} missing`);
  const circuit = catalog.circuits.find((candidate) => candidate.circuitKey === number(meeting.circuit_key));
  if (!circuit) throw new Error('Hungaroring missing from catalog');
  const nextEvent = catalog.events.find((event) => event.startsAt > iso(meeting.date_end) && event.status !== 'cancelled');
  const circuitInfo = await fetchObject(requiredString(meeting.circuit_info_url));
  const pitLoss = number((circuitInfo.pitLoss as RawRecord | undefined)?.normal);
  return {
    schemaVersion: 2,
    provenance: {
      provider: 'OpenF1',
      sessionKey,
      sourceUrl: `${apiBaseUrl}/sessions?session_key=${sessionKey}`,
      generatedAt: catalog.generatedAt
    },
    meeting: {
      id: 'meeting:replay:hungary-2026',
      name: requiredString(meeting.meeting_name),
      countryCode: requiredString(meeting.country_code),
      circuitId: circuit.id,
      circuitName: circuit.name,
      startsAt: iso(meeting.date_start),
      endsAt: iso(meeting.date_end),
      isCancelled: false,
      circuitImageUrl: circuit.layoutImageUrl,
      circuitInfoUrl: string(meeting.circuit_info_url),
      sessions: sessions.flatMap(normalizeSessionSummary),
      ...(nextEvent ? { nextMeeting: { id: nextEvent.id, name: nextEvent.name, startsAt: nextEvent.startsAt } } : {})
    },
    track: {
      id: circuit.id,
      name: circuit.name,
      countryCode: circuit.countryCode,
      lengthKm: null,
      laps: 70,
      pitLossSec: pitLoss || null,
      drsZones: [],
      sectors: ['S1', 'S2', 'S3'],
      layoutPath: circuit.layoutImageUrl,
      layoutSourceUrl: circuit.layoutSourceUrl,
      layoutVerifiedAt: circuit.layoutVerifiedAt,
      layoutStatus: circuit.layoutStatus
    },
    session: { initialSnapshot, finalSnapshot }
  };
}

function normalizeSessionSummary(raw: RawRecord): Record<string, unknown>[] {
  const name = requiredString(raw.session_name);
  const kind = /practice/iu.test(name) ? 'practice' : /qualifying/iu.test(name) ? 'qualifying' : /sprint/iu.test(name) ? 'sprint' : /race/iu.test(name) ? 'race' : null;
  if (!kind) return [];
  const key = number(raw.session_key);
  return [{
    id: kind === 'race' ? 'session:replay:hungary-race-2026' : `session:replay:hungary-${key}-2026`,
    name,
    kind,
    startsAt: iso(raw.date_start),
    endsAt: iso(raw.date_end),
    phase: 'finished_final'
  }];
}

function buildReplayEvents(finalSnapshot: SessionSnapshot): Record<string, unknown>[] {
  const event = (pattern: RegExp) => {
    const match = finalSnapshot.raceControl.find((candidate) => pattern.test(candidate.sourceText));
    if (!match) throw new Error(`Replay race-control event missing: ${pattern}`);
    return match;
  };
  const yellow = event(/^YELLOW IN TRACK SECTOR 8$/u);
  const clear = event(/^CLEAR IN TRACK SECTOR 8$/u);
  const chequered = event(/^CHEQUERED FLAG$/u);
  return [
    { atMs: 2000, sourceUpdatedAt: yellow.occurredAt, type: 'status', payload: { trackStatus: { code: 'YELLOW', label: 'Yellow flag' }, lap: 50, raceControl: yellow } },
    { atMs: 3000, sourceUpdatedAt: clear.occurredAt, type: 'status', payload: { trackStatus: { code: 'GREEN', label: 'Track clear' }, lap: 50, raceControl: clear } },
    { atMs: 4000, sourceUpdatedAt: chequered.occurredAt, type: 'status', payload: { trackStatus: { code: 'CHEQUERED', label: 'Chequered flag' }, lap: 70, raceControl: chequered } },
    { atMs: 5000, sourceUpdatedAt: finalSnapshot.meta.sourceUpdatedAt, type: 'final', payload: {} }
  ];
}

async function fetchArray(path: string, attempt = 0): Promise<RawRecord[]> {
  const response = await fetch(`${apiBaseUrl}/${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
  if (response.status === 429 && attempt < 4) {
    const retryAfterSeconds = Number(response.headers.get('Retry-After'));
    await sleep(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1_000 : 1_000 * (attempt + 1));
    return fetchArray(path, attempt + 1);
  }
  if (!response.ok) throw new Error(`OpenF1 ${path} failed (${response.status})`);
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new Error(`OpenF1 ${path} did not return an array`);
  return value as RawRecord[];
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchObject(url: string): Promise<RawRecord> {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Circuit info failed (${response.status})`);
  return await response.json() as RawRecord;
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await writeFile(resolve(fixtureDirectory, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function teamId(name: string): string {
  return `team:${name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')}:2026`;
}

function circuitId(key: number): string {
  return `track:openf1:${key}`;
}

function normalizeCircuitType(value: string | null): 'Permanent' | 'Street' | 'Temporary' | 'Unknown' {
  if (/street/iu.test(value ?? '')) return 'Street';
  if (/temporary/iu.test(value ?? '')) return 'Temporary';
  if (/permanent/iu.test(value ?? '')) return 'Permanent';
  return 'Unknown';
}

function formulaOneImage(value: unknown): string {
  const url = new URL(requiredString(value));
  if (url.protocol !== 'https:' || url.hostname !== 'media.formula1.com') throw new Error(`Unapproved circuit image: ${url}`);
  return url.toString();
}

async function verifyFormulaOneImage(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) });
      if (response.ok && response.headers.get('content-type')?.startsWith('image/') === true) return true;
    } catch {
      // Retry transient media failures before marking the approved asset unavailable.
    }
    await sleep(250 * (attempt + 1));
  }
  return false;
}

function color(value: unknown): string {
  return `#${requiredString(value).replace(/^#/u, '').toUpperCase()}`;
}

function titleCase(value: string): string {
  return value.toLocaleLowerCase('en').replace(/(^|[-'\s])\p{L}/gu, (letter) => letter.toLocaleUpperCase('en'));
}

function iso(value: unknown): string {
  const parsed = new Date(requiredString(value));
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Invalid date: ${String(value)}`);
  return parsed.toISOString();
}

function timestamp(value: unknown): number {
  const parsed = Date.parse(requiredString(value));
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function number(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid number: ${String(value)}`);
  return parsed;
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function requiredString(value: unknown): string {
  const parsed = string(value);
  if (!parsed) throw new Error(`Missing string: ${String(value)}`);
  return parsed;
}

function boolean(value: unknown): boolean {
  return value === true;
}

await main();
