import type { DataHealth, SessionSnapshot } from '@f1/domain';

const healthStates = new Set<DataHealth['state']>(['fresh', 'stale', 'offline', 'rate_limited', 'unavailable']);

export function parseSessionSnapshotPayload(value: unknown): SessionSnapshot | null {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.meetingId !== 'string'
    || !Number.isInteger(value.revision)
    || !isRecord(value.trackStatus)
    || typeof value.trackStatus.code !== 'string'
    || typeof value.trackStatus.label !== 'string'
    || !isRecord(value.meta)
    || typeof value.meta.provider !== 'string'
    || typeof value.meta.stale !== 'boolean'
    || !Array.isArray(value.drivers)
    || !value.drivers.every(isDriverEnvelope)
    || !Array.isArray(value.raceControl)
    || !Array.isArray(value.battles)
    || !Array.isArray(value.pitProjections)
    || !Array.isArray(value.strategySignals)
    || !Array.isArray(value.insights)) {
    return null;
  }
  return value as SessionSnapshot;
}

export function parseDataHealthPayload(value: unknown): DataHealth | null {
  if (!isRecord(value)
    || typeof value.provider !== 'string'
    || typeof value.state !== 'string'
    || !healthStates.has(value.state as DataHealth['state'])
    || !(value.lastSuccessAt === null || isTimestamp(value.lastSuccessAt))
    || !Number.isInteger(value.consecutiveFailures)
    || (value.consecutiveFailures as number) < 0
    || typeof value.rateLimited !== 'boolean'
    || !(value.message === null || typeof value.message === 'string')) {
    return null;
  }
  return value as DataHealth;
}

export function hasSameSnapshotIdentity(value: unknown, current: SessionSnapshot): boolean {
  return isRecord(value) && value.id === current.id && value.revision === current.revision;
}

export function canReuseSnapshotPayload(
  value: unknown,
  current: SessionSnapshot,
  requestedDelaySeconds: number,
  favoriteDriverId: string | null
): boolean {
  return favoriteDriverId === null
    && requestedDelaySeconds === current.requestedDelaySeconds
    && hasSameSnapshotIdentity(value, current);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDriverEnvelope(value: unknown): boolean {
  return isRecord(value)
    && typeof value.driverId === 'string'
    && typeof value.code === 'string'
    && Array.isArray(value.stints)
    && Array.isArray(value.laps);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
