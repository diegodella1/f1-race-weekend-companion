import { describe, expect, it } from 'vitest';
import { getMockSnapshot } from '../../../../../packages/domain/src/__tests__/factories';
import {
  canReuseSnapshotPayload,
  hasSameSnapshotIdentity,
  parseDataHealthPayload,
  parseSessionSnapshotPayload
} from '../live-payload';

describe('live payload guards', () => {
  it('accepts a complete data-health payload', () => {
    const health = {
      provider: 'replay',
      state: 'fresh',
      lastSuccessAt: '2024-06-30T14:00:00.000Z',
      consecutiveFailures: 0,
      rateLimited: false,
      message: null
    };
    expect(parseDataHealthPayload(health)).toEqual(health);
  });

  it('rejects malformed data-health payloads', () => {
    expect(parseDataHealthPayload({ provider: 'replay', state: 'fresh' })).toBeNull();
    expect(parseDataHealthPayload({
      provider: 'replay', state: 'fresh', lastSuccessAt: null,
      consecutiveFailures: -1, rateLimited: false, message: null
    })).toBeNull();
  });

  it('deduplicates only the same session revision', () => {
    const snapshot = getMockSnapshot({ revision: 4 });
    expect(hasSameSnapshotIdentity({ id: snapshot.id, revision: 4 }, snapshot)).toBe(true);
    expect(hasSameSnapshotIdentity({ id: snapshot.id, revision: 5 }, snapshot)).toBe(false);
    expect(hasSameSnapshotIdentity({ id: 'other', revision: 4 }, snapshot)).toBe(false);
  });

  it('guards the render-critical snapshot envelope', () => {
    const snapshot = getMockSnapshot({ revision: 4 });
    expect(parseSessionSnapshotPayload(snapshot)).toEqual(snapshot);
    expect(parseSessionSnapshotPayload({ ...snapshot, drivers: null })).toBeNull();
    expect(parseSessionSnapshotPayload({ ...snapshot, trackStatus: null })).toBeNull();
  });

  it('does not reuse a revision across personalized views', () => {
    const snapshot = getMockSnapshot({ revision: 4, requestedDelaySeconds: 0 });
    const payload = { id: snapshot.id, revision: 4 };
    expect(canReuseSnapshotPayload(payload, snapshot, 0, null)).toBe(true);
    expect(canReuseSnapshotPayload(payload, snapshot, 30, null)).toBe(false);
    expect(canReuseSnapshotPayload(payload, snapshot, 0, 'driver:81:2024')).toBe(false);
  });
});
