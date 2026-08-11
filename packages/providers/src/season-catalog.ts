import {
  seasonCatalogSchema,
  type CircuitProfile,
  type SeasonCatalog,
  type SeasonEvent
} from '@f1/domain';
import { z } from 'zod';
import { ProviderError } from './types';

const rawMeetingSchema = z.object({
  meeting_key: z.number().int().nonnegative(),
  meeting_name: z.string().min(1),
  meeting_official_name: z.string().min(1).nullable().optional(),
  location: z.string().min(1),
  country_code: z.string().min(2).max(3),
  country_name: z.string().min(1),
  circuit_key: z.number().int().nonnegative(),
  circuit_short_name: z.string().min(1),
  circuit_type: z.string().nullable().optional(),
  circuit_info_url: z.string().url().nullable().optional(),
  circuit_image: z.string().url().nullable().optional(),
  date_start: z.string(),
  date_end: z.string(),
  year: z.literal(2026),
  is_cancelled: z.boolean().default(false)
});

const rawMeetingsSchema = z.array(rawMeetingSchema);
type RawMeeting = z.infer<typeof rawMeetingSchema>;
type CatalogFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export async function syncSeasonCatalog(
  fallback: SeasonCatalog,
  options: { baseUrl?: string; fetcher?: CatalogFetcher; now?: Date } = {}
): Promise<SeasonCatalog> {
  const baseUrl = (options.baseUrl ?? 'https://api.openf1.org/v1').replace(/\/$/u, '');
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const response = await fetchMeetings(fetcher, `${baseUrl}/meetings?year=2026`);
  const meetings = rawMeetingsSchema.parse(response).filter(isGrandPrix);
  if (meetings.length < 20) throw new ProviderError('OpenF1 returned an incomplete 2026 calendar', 'INVALID_PROVIDER_RESPONSE', false, 502);
  return buildCatalog(fallback, meetings, now);
}

async function fetchMeetings(fetcher: CatalogFetcher, url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
  } catch {
    throw new ProviderError('2026 catalog sync could not connect', 'PROVIDER_NETWORK_ERROR', true, 503);
  }
  if (!response.ok) throw new ProviderError(`2026 catalog sync failed (${response.status})`, 'PROVIDER_ERROR', response.status >= 500, response.status);
  return response.json();
}

function buildCatalog(fallback: SeasonCatalog, meetings: RawMeeting[], now: Date): SeasonCatalog {
  const approvedCircuits = new Map(fallback.circuits.map((circuit) => [circuit.circuitKey, circuit]));
  const circuits = uniqueCircuits(meetings).map((meeting) => normalizeCircuit(meeting, approvedCircuits.get(meeting.circuit_key)));
  const events = meetings.map((meeting) => normalizeEvent(meeting, now)).sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  return seasonCatalogSchema.parse({
    ...fallback,
    generatedAt: now.toISOString(),
    events,
    circuits
  });
}

function uniqueCircuits(meetings: RawMeeting[]): RawMeeting[] {
  const circuits = new Map<number, RawMeeting>();
  for (const meeting of meetings) circuits.set(meeting.circuit_key, meeting);
  return [...circuits.values()];
}

function normalizeEvent(meeting: RawMeeting, now: Date): SeasonEvent {
  const startsAt = requiredIso(meeting.date_start);
  const endsAt = requiredIso(meeting.date_end);
  const status = meeting.is_cancelled ? 'cancelled' : Date.parse(endsAt) < now.getTime() ? 'completed' : 'scheduled';
  return {
    id: `meeting:openf1:${meeting.meeting_key}`,
    meetingKey: meeting.meeting_key,
    name: meeting.meeting_name,
    officialName: meeting.meeting_official_name ?? meeting.meeting_name,
    circuitId: circuitId(meeting.circuit_key),
    startsAt,
    endsAt,
    status
  };
}

function normalizeCircuit(meeting: RawMeeting, approved?: CircuitProfile): CircuitProfile {
  const candidateImage = formulaOneImage(meeting.circuit_image);
  const unchangedAssociation = approved?.upstreamImageUrl === candidateImage;
  return {
    id: circuitId(meeting.circuit_key),
    circuitKey: meeting.circuit_key,
    name: meeting.circuit_short_name,
    location: meeting.location,
    countryCode: meeting.country_code.toUpperCase(),
    countryName: meeting.country_name,
    type: circuitType(meeting.circuit_type),
    upstreamImageUrl: candidateImage,
    layoutImageUrl: unchangedAssociation ? approved.layoutImageUrl : null,
    layoutSourceUrl: unchangedAssociation ? approved.layoutSourceUrl : null,
    layoutStatus: unchangedAssociation ? approved.layoutStatus : 'pending',
    layoutVerifiedAt: unchangedAssociation ? approved.layoutVerifiedAt : null
  };
}

function isGrandPrix(meeting: RawMeeting): boolean {
  return !/testing/iu.test(meeting.meeting_name);
}

function circuitId(key: number): string {
  return `track:openf1:${key}`;
}

function formulaOneImage(value: string | null | undefined): string | null {
  if (!value) return null;
  const url = new URL(value);
  return url.protocol === 'https:' && url.hostname === 'media.formula1.com' ? url.toString() : null;
}

function circuitType(value: string | null | undefined): CircuitProfile['type'] {
  if (/street/iu.test(value ?? '')) return 'Street';
  if (/temporary/iu.test(value ?? '')) return 'Temporary';
  if (/permanent/iu.test(value ?? '')) return 'Permanent';
  return 'Unknown';
}

function requiredIso(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new ProviderError('OpenF1 returned an invalid catalog date', 'INVALID_PROVIDER_RESPONSE', false, 502);
  return new Date(timestamp).toISOString();
}
