export interface CacheStore {
  get<T>(key: string, staleAllowanceMs?: number): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maximumEntries = 100
  ) {}

  async get<T>(key: string, staleAllowanceMs = 0): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt + staleAllowanceMs < this.now()) {
      return null;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    while (this.entries.size > this.maximumEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

export class RequestCoalescer {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<T>;
    const promise = work().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly failureThreshold = 5,
    private readonly halfOpenAfterMs = 30_000,
    private readonly now: () => number = Date.now
  ) {}

  canRequest(): boolean {
    return this.failures < this.failureThreshold || this.now() - this.openedAt >= this.halfOpenAfterMs;
  }

  success(): void {
    this.failures = 0;
    this.openedAt = 0;
  }

  failure(): void {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) this.openedAt = this.now();
  }

  consecutiveFailures(): number {
    return this.failures;
  }
}
