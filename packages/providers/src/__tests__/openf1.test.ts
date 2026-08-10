import { describe, expect, it, vi } from 'vitest';
import { FakeClock } from '@f1/domain';
import { OpenF1Adapter } from '../openf1';

const payloads: Record<string, unknown> = {
  meetings: [{ meeting_key: 1240, meeting_name: 'Austrian Grand Prix', country_code: 'AUT', circuit_key: 19, circuit_short_name: 'Spielberg', date_start: '2024-06-28T10:30:00+00:00', date_end: '2024-06-30T15:00:00+00:00' }],
  sessions: [{ session_key: 9596, meeting_key: 1240, session_name: 'Race', session_type: 'Race', date_start: '2024-06-30T13:00:00+00:00', date_end: '2024-06-30T15:00:00+00:00' }],
  drivers: [
    { driver_number: 4, full_name: 'Lando Norris', name_acronym: 'NOR', team_name: 'McLaren', team_colour: 'FF8700' },
    { driver_number: 1, full_name: 'Max Verstappen', name_acronym: 'VER', team_name: 'Red Bull Racing', team_colour: '3671C6' }
  ],
  position: [
    { driver_number: 4, position: 1, date: '2024-06-30T14:00:00+00:00' },
    { driver_number: 1, position: 2, date: '2024-06-30T14:00:00+00:00' }
  ],
  intervals: [
    { driver_number: 4, gap_to_leader: 0, interval: null, date: '2024-06-30T14:00:00+00:00' },
    { driver_number: 1, gap_to_leader: 2.1, interval: 2.1, date: '2024-06-30T14:00:00+00:00' }
  ],
  laps: [
    { driver_number: 4, lap_number: 2, lap_duration: 69.1, duration_sector_1: 22.1, duration_sector_2: 25.0, duration_sector_3: 22.0, date_start: '2024-06-30T13:03:00+00:00', is_pit_out_lap: false },
    { driver_number: 4, lap_number: 3, lap_duration: 68.9, duration_sector_1: 22.0, duration_sector_2: 24.9, duration_sector_3: 22.0, date_start: '2024-06-30T13:04:10+00:00', is_pit_out_lap: false },
    { driver_number: 4, lap_number: 4, lap_duration: 68.8, duration_sector_1: 21.9, duration_sector_2: 24.9, duration_sector_3: 22.0, date_start: '2024-06-30T13:05:20+00:00', is_pit_out_lap: false },
    { driver_number: 1, lap_number: 2, lap_duration: 69.2, duration_sector_1: 22.2, duration_sector_2: 25.0, duration_sector_3: 22.0, date_start: '2024-06-30T13:03:02+00:00', is_pit_out_lap: false },
    { driver_number: 1, lap_number: 3, lap_duration: 69.0, duration_sector_1: 22.1, duration_sector_2: 24.9, duration_sector_3: 22.0, date_start: '2024-06-30T13:04:12+00:00', is_pit_out_lap: false },
    { driver_number: 1, lap_number: 4, lap_duration: 68.95, duration_sector_1: 22.0, duration_sector_2: 24.9, duration_sector_3: 22.05, date_start: '2024-06-30T13:05:22+00:00', is_pit_out_lap: false }
  ],
  stints: [{ driver_number: 4, stint_number: 1, compound: 'MEDIUM', lap_start: 1, lap_end: null, tyre_age_at_start: 0 }],
  pit: [],
  race_control: [{ category: 'Flag', flag: 'GREEN', message: 'GREEN LIGHT - PIT EXIT OPEN', date: '2024-06-30T13:00:00+00:00', driver_number: null }],
  session_result: []
};

describe('OpenF1Adapter', () => {
  it('normalizes provider payloads and keeps missing compounds null', async () => {
    const fetcher = createFetch();
    const adapter = new OpenF1Adapter({
      baseUrl: 'https://api.openf1.test/v1',
      clock: new FakeClock(new Date('2024-06-30T14:00:04.000Z')),
      fetcher,
      requestIntervalMs: 0
    });
    const snapshot = await adapter.getSessionSnapshot('session:openf1:9596');
    expect(snapshot.drivers).toHaveLength(2);
    expect(snapshot.drivers.find((driver) => driver.number === 1)?.currentStint).toBeNull();
    expect(snapshot.drivers[0]?.teamColor).toBe('#FF8700');
    expect(snapshot.meta.ageSeconds).toBe(4);
  });

  it('maps meetings and sessions to stable internal IDs', async () => {
    const adapter = new OpenF1Adapter({ baseUrl: 'https://api.openf1.test/v1', clock: new FakeClock(new Date()), fetcher: createFetch(), requestIntervalMs: 0 });
    const meetings = await adapter.getMeetings({ from: '2024-06-01T00:00:00.000Z', to: '2024-07-01T00:00:00.000Z' });
    expect(meetings[0]?.id).toBe('meeting:openf1:1240');
    expect(meetings[0]?.sessions[0]?.id).toBe('session:openf1:9596');
  });

  it('obtains and uses an OAuth token without exposing credentials in errors', async () => {
    const fetcher = createFetch(true);
    const adapter = new OpenF1Adapter({
      baseUrl: 'https://api.openf1.test/v1',
      clock: new FakeClock(new Date('2024-06-30T14:00:04.000Z')),
      fetcher,
      requestIntervalMs: 0,
      username: 'operator@example.com',
      password: 'secret-password'
    });
    await adapter.getSessions('meeting:openf1:1240');
    expect(fetcher).toHaveBeenCalledWith('https://api.openf1.test/token', expect.objectContaining({ method: 'POST' }));
    const calls = fetcher.mock.calls as Array<[string | URL | Request, RequestInit?]>;
    const authenticated = calls.find(([url]) => String(url).includes('/sessions?'))?.[1];
    expect(new Headers(authenticated?.headers).get('Authorization')).toBe('Bearer test-token');
  });

  it('retries rate limits and honors a zero Retry-After response', async () => {
    const fetcher = createFetch();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '0' } }));
    const adapter = new OpenF1Adapter({
      baseUrl: 'https://api.openf1.test/v1',
      clock: new FakeClock(new Date()),
      fetcher,
      requestIntervalMs: 0
    });
    const sessions = await adapter.getSessions('meeting:openf1:1240');
    expect(sessions).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

function createFetch(withAuth = false) {
  return vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/token' && withAuth) return Response.json({ access_token: 'test-token', expires_in: 3600 });
    const endpoint = url.pathname.split('/').at(-1) ?? '';
    return Response.json(payloads[endpoint] ?? []);
  });
}
