import { describe, expect, it } from 'vitest';
import { defaultPreferences, parsePreferences } from '../preferences';

describe('preferences migration boundary', () => {
  it('restores defaults for corrupt local values', () => {
    expect(parsePreferences({ syncDelaySeconds: 999, favoriteDriverId: 7 })).toEqual(defaultPreferences);
  });

  it('accepts a complete version-one preference document', () => {
    expect(parsePreferences({ ...defaultPreferences, favoriteDriverId: 'driver:81:2024', syncDelaySeconds: 30 })).toMatchObject({
      favoriteDriverId: 'driver:81:2024',
      syncDelaySeconds: 30
    });
  });
});
