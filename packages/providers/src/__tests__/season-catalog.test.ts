import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seasonCatalogSchema } from '@f1/domain';
import { syncSeasonCatalog } from '../season-catalog';

async function fallbackCatalog() {
  return seasonCatalogSchema.parse(JSON.parse(await readFile(resolve(process.cwd(), 'fixtures/season-2026.json'), 'utf8')));
}

describe('season catalog sync', () => {
  it('blocks a changed circuit image until it is approved', async () => {
    const fallback = await fallbackCatalog();
    const rawMeetings = fallback.events.map((event) => {
      const circuit = fallback.circuits.find((candidate) => candidate.id === event.circuitId)!;
      return {
        meeting_key: event.meetingKey,
        meeting_name: event.name,
        meeting_official_name: event.officialName,
        location: circuit.location,
        country_code: circuit.countryCode,
        country_name: circuit.countryName,
        circuit_key: circuit.circuitKey,
        circuit_short_name: circuit.name,
        circuit_type: circuit.type,
        circuit_info_url: circuit.layoutSourceUrl,
        circuit_image: circuit.circuitKey === fallback.circuits[0]?.circuitKey
          ? 'https://media.formula1.com/unapproved-change.png'
          : circuit.upstreamImageUrl,
        date_start: event.startsAt,
        date_end: event.endsAt,
        year: 2026,
        is_cancelled: event.status === 'cancelled'
      };
    });

    const synced = await syncSeasonCatalog(fallback, {
      now: new Date('2026-08-10T12:00:00.000Z'),
      fetcher: async () => Response.json(rawMeetings)
    });

    expect(synced.circuits[0]).toMatchObject({ layoutImageUrl: null, layoutStatus: 'pending', layoutVerifiedAt: null });
    expect(synced.circuits.slice(1).map((circuit) => circuit.layoutStatus)).toEqual(fallback.circuits.slice(1).map((circuit) => circuit.layoutStatus));
  });

  it('rejects incomplete upstream calendars', async () => {
    const fallback = await fallbackCatalog();
    await expect(syncSeasonCatalog(fallback, {
      fetcher: async () => Response.json([])
    })).rejects.toThrow('incomplete 2026 calendar');
  });
});
