import type { Clock, DataHealth, Meeting, SessionPatch, SessionSnapshot } from '@f1/domain';
import {
  buildInsights,
  calculateConfidence,
  calculatePace,
  calculatePitProjection,
  detectStrategySignals,
  detectBattles,
  markCleanLaps
} from '@f1/domain';
import { CircuitBreaker, MemoryCacheStore, RequestCoalescer, type CacheStore } from './cache';
import { ProviderError, type TimingProvider } from './types';

interface SnapshotOptions {
  delaySeconds: number;
  favoriteDriverId: string | null;
}

interface BufferedSnapshot {
  recordedAtMs: number;
  snapshot: SessionSnapshot;
}

export class SessionEngine {
  private readonly coalescer = new RequestCoalescer();
  private readonly breaker: CircuitBreaker;
  private readonly buffers = new Map<string, BufferedSnapshot[]>();
  private readonly previous = new Map<string, SessionSnapshot>();
  private lastSuccessAt: string | null = null;
  private rateLimited = false;

  constructor(
    private readonly provider: TimingProvider,
    private readonly clock: Clock,
    private readonly cache: CacheStore = new MemoryCacheStore()
  ) {
    this.breaker = new CircuitBreaker(5, 30_000, () => this.clock.now().getTime());
  }

  capabilities() {
    return this.provider.capabilities();
  }

  async getCurrentWeekend(): Promise<Meeting | null> {
    const now = this.clock.now();
    const from = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1_000).toISOString();
    const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1_000).toISOString();
    const meetings = await this.provider.getMeetings({ from, to });
    return meetings[0] ?? null;
  }

  async getSnapshot(sessionId: string, options: SnapshotOptions): Promise<SessionSnapshot> {
    const fresh = await this.fetchSnapshot(sessionId);
    const enriched = this.enrich(fresh, options.favoriteDriverId);
    this.remember(sessionId, enriched);
    return this.selectDelayed(sessionId, options.delaySeconds);
  }

  async getDriver(sessionId: string, driverId: string, options: SnapshotOptions) {
    const snapshot = await this.getSnapshot(sessionId, options);
    return snapshot.drivers.find((driver) => driver.driverId === driverId) ?? null;
  }

  async compare(sessionId: string, driverIds: [string, string], options: SnapshotOptions) {
    const snapshot = await this.getSnapshot(sessionId, options);
    return driverIds.map((driverId) => snapshot.drivers.find((driver) => driver.driverId === driverId) ?? null);
  }

  getHealth(): DataHealth {
    const failures = this.breaker.consecutiveFailures();
    const state = this.rateLimited ? 'rate_limited' : failures > 0 ? 'stale' : this.lastSuccessAt ? 'fresh' : 'unavailable';
    return {
      provider: this.provider.name,
      state,
      lastSuccessAt: this.lastSuccessAt,
      consecutiveFailures: failures,
      rateLimited: this.rateLimited,
      message: this.rateLimited ? 'Provider is limiting updates; showing cached data' : failures > 0 ? 'Using last known session data' : null
    };
  }

  createPatch(previous: SessionSnapshot, current: SessionSnapshot): SessionPatch {
    const previousRaceControlIds = new Set(previous.raceControl.map((event) => event.id));
    return {
      revision: current.revision,
      baseRevision: previous.revision,
      session: {
        phase: current.phase,
        segment: current.segment,
        clockSeconds: current.clockSeconds,
        lap: current.lap,
        trackStatus: current.trackStatus
      },
      drivers: current.drivers,
      raceControlAppend: current.raceControl.filter((event) => !previousRaceControlIds.has(event.id)),
      battles: current.battles,
      pitProjections: current.pitProjections,
      strategySignals: current.strategySignals,
      insights: current.insights,
      meta: current.meta
    };
  }

  private async fetchSnapshot(sessionId: string): Promise<SessionSnapshot> {
    return this.coalescer.run(`snapshot:${sessionId}`, async () => {
      if (!this.breaker.canRequest()) {
        const stale = await this.cache.get<SessionSnapshot>(`snapshot:${sessionId}`, 30_000);
        if (stale) return this.asStale(stale);
        throw new ProviderError('Provider circuit is open', 'PROVIDER_UNAVAILABLE', true, 503);
      }
      try {
        const snapshot = await this.provider.getSessionSnapshot(sessionId);
        await this.cache.set(`snapshot:${sessionId}`, snapshot, 5_000);
        this.breaker.success();
        this.rateLimited = false;
        this.lastSuccessAt = this.clock.now().toISOString();
        return snapshot;
      } catch (error) {
        this.breaker.failure();
        this.rateLimited = error instanceof ProviderError && error.status === 429;
        const stale = await this.cache.get<SessionSnapshot>(`snapshot:${sessionId}`, 30_000);
        if (stale) return this.asStale(stale);
        throw error;
      }
    });
  }

  private enrich(snapshot: SessionSnapshot, favoriteDriverId: string | null): SessionSnapshot {
    const drivers = snapshot.drivers.map((driver) => {
      const laps = markCleanLaps(driver.laps, snapshot.kind);
      return {
        ...driver,
        laps,
        pace3Sec: calculatePace(laps, 3).value,
        pace5Sec: calculatePace(laps, 5).value
      };
    });
    const sampleSize = Math.min(5, ...drivers.map((driver) => driver.laps.filter((lap) => lap.clean).length));
    const battles = detectBattles(drivers, favoriteDriverId, snapshot.trackStatus.code, Number.isFinite(sampleSize) ? sampleSize : 0);
    const predictionConfidence = calculateConfidence({
      samples: Number.isFinite(sampleSize) ? sampleSize : 0,
      ageSeconds: snapshot.meta.ageSeconds,
      madSec: 0.18,
      disrupted: ['SC', 'VSC', 'RED'].includes(snapshot.trackStatus.code)
    });
    const pitProjections = drivers.map((driver) =>
      calculatePitProjection(driver, drivers, 21.5, predictionConfidence, snapshot.trackStatus.code)
    );
    const strategySignals = detectStrategySignals(drivers, pitProjections, snapshot.trackStatus.code, snapshot.meta.ageSeconds);
    const base = { ...snapshot, drivers, battles, pitProjections, strategySignals, insights: [] };
    const previous = this.previous.get(snapshot.id) ?? null;
    const enriched = { ...base, insights: buildInsights(previous, base, favoriteDriverId) };
    this.previous.set(snapshot.id, enriched);
    return enriched;
  }

  private remember(sessionId: string, snapshot: SessionSnapshot): void {
    const now = this.clock.now().getTime();
    const buffer = this.buffers.get(sessionId) ?? [];
    if (buffer.at(-1)?.snapshot.revision !== snapshot.revision) {
      buffer.push({ recordedAtMs: now, snapshot });
    }
    const cutoff = now - 120_000;
    this.buffers.set(sessionId, buffer.filter((entry) => entry.recordedAtMs >= cutoff));
  }

  private selectDelayed(sessionId: string, delaySeconds: number): SessionSnapshot {
    const buffer = this.buffers.get(sessionId) ?? [];
    const now = this.clock.now().getTime();
    const target = now - delaySeconds * 1_000;
    const selected = [...buffer].reverse().find((entry) => entry.recordedAtMs <= target) ?? buffer[0];
    if (!selected) throw new ProviderError('No session snapshot available', 'SNAPSHOT_UNAVAILABLE', true, 503);
    const effectiveDelaySeconds = Math.max(0, (now - selected.recordedAtMs) / 1_000);
    return {
      ...selected.snapshot,
      requestedDelaySeconds: delaySeconds,
      effectiveDelaySeconds
    };
  }

  private asStale(snapshot: SessionSnapshot): SessionSnapshot {
    return {
      ...snapshot,
      meta: {
        ...snapshot.meta,
        stale: true,
        ageSeconds: Math.max(snapshot.meta.ageSeconds, 5)
      }
    };
  }
}
