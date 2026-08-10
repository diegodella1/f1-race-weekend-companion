import { describe, expect, it } from 'vitest';
import type { SessionPatch } from '@f1/domain';
import { applySessionPatch } from '../session-patch';
import { getMockSnapshot } from '../../../../../packages/domain/src/__tests__/factories';

describe('SSE session patches', () => {
  it('rejects a patch based on an unknown revision', () => {
    const snapshot = getMockSnapshot({ revision: 4 });
    expect(applySessionPatch(snapshot, { revision: 6, baseRevision: 3 } as SessionPatch)).toBeNull();
  });

  it('deduplicates race-control events while applying an atomic revision', () => {
    const event = {
      id: 'rc:1', occurredAt: '2024-06-30T14:00:00.000Z', category: 'flag' as const,
      priority: 'high' as const, sourceText: 'RED FLAG', label: 'Red flag', driverIds: []
    };
    const snapshot = getMockSnapshot({ revision: 4, raceControl: [event] });
    const updated = applySessionPatch(snapshot, { revision: 5, baseRevision: 4, raceControlAppend: [event] });
    expect(updated?.revision).toBe(5);
    expect(updated?.raceControl).toHaveLength(1);
  });
});
