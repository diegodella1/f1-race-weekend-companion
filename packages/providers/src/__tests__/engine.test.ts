import { describe, expect, it, vi } from 'vitest';
import { FakeClock, type DateRange, type Meeting, type ProviderCapabilities, type SessionSnapshot } from '@f1/domain';
import { SessionEngine } from '../session-engine';
import type { ProviderUpdateBatch, TimingProvider } from '../types';
import { ReplayAdapter } from '../replay';
import { resolve } from 'node:path';

const fixturePath = resolve(process.cwd(), 'fixtures/2026-hungary-race.json');
const eventsPath = resolve(process.cwd(), 'fixtures/2026-hungary-race.ndjson');
const sessionId = 'session:replay:hungary-race-2026';

describe('SessionEngine', () => {
  it('derives battles, pit projections, and auditable insights', async () => {
    const clock = new FakeClock(new Date('2026-07-26T14:04:00.000Z'));
    const adapter = await ReplayAdapter.create({ fixturePath, eventsPath, clock });
    const engine = new SessionEngine(adapter, clock);

    const snapshot = await engine.getSnapshot(sessionId, {
      delaySeconds: 0,
      favoriteDriverId: 'driver:1:2026'
    });

    expect(snapshot.battles.length).toBeGreaterThan(0);
    expect(snapshot.pitProjections.length).toBeGreaterThan(0);
    expect(snapshot.insights.some((insight) => insight.type === 'favorite')).toBe(true);
  });

  it('preserves real replay race-control events without inventing neutralization', async () => {
    const clock = new FakeClock(new Date('2026-07-26T14:04:00.000Z'));
    const adapter = await ReplayAdapter.create({ fixturePath, eventsPath, clock });
    const engine = new SessionEngine(adapter, clock);
    await engine.getSnapshot(sessionId, { delaySeconds: 0, favoriteDriverId: null });
    adapter.play();
    clock.advance(2_100);

    const snapshot = await engine.getSnapshot(sessionId, { delaySeconds: 0, favoriteDriverId: null });

    expect(snapshot.trackStatus).toEqual({ code: 'YELLOW', label: 'Yellow flag' });
    expect(snapshot.raceControl.at(-1)?.sourceText).toBe('YELLOW IN TRACK SECTOR 8');
  });

  it('coalesces concurrent upstream requests', async () => {
    const snapshot = createSmallSnapshot();
    const provider = createProvider(snapshot);
    const engine = new SessionEngine(provider, new FakeClock(new Date('2024-01-01T00:00:00.000Z')));

    await Promise.all(Array.from({ length: 5 }, () =>
      engine.getSnapshot(snapshot.id, { delaySeconds: 0, favoriteDriverId: null })
    ));

    expect(provider.getSessionSnapshot).toHaveBeenCalledTimes(1);
  });
});

function createSmallSnapshot(): SessionSnapshot {
  return {
    id: 'session:test:1', meetingId: 'meeting:test:1', kind: 'race', phase: 'live', segment: null,
    startedAt: '2024-01-01T00:00:00.000Z', endsAt: null, clockSeconds: null, lap: 2, totalLaps: 10,
    trackStatus: { code: 'GREEN', label: 'Green flag' }, drivers: [], raceControl: [], battles: [],
    pitProjections: [], strategySignals: [], insights: [], revision: 1, requestedDelaySeconds: 0, effectiveDelaySeconds: 0,
    meta: { provider: 'test', sourceUpdatedAt: '2024-01-01T00:00:00.000Z', ingestedAt: '2024-01-01T00:00:00.000Z', stale: false, ageSeconds: 0 }
  };
}

function createProvider(snapshot: SessionSnapshot): TimingProvider & { getSessionSnapshot: ReturnType<typeof vi.fn> } {
  const capabilities: ProviderCapabilities = {
    gaps: true, sectors: false, stints: false, raceControl: false, weather: false,
    physicalOrder: false, drsStatus: false, finalClassification: false, livePush: false
  };
  return {
    name: 'test',
    getMeetings: vi.fn(async (_range: DateRange): Promise<Meeting[]> => []),
    getSessions: vi.fn(async () => []),
    getSessionSnapshot: vi.fn(async () => snapshot),
    getUpdates: vi.fn(async (): Promise<ProviderUpdateBatch> => ({ updates: [], nextCursor: null })),
    getHistoricalSession: vi.fn(async () => snapshot),
    capabilities: () => capabilities
  };
}
