import type { Preferences } from './models';

const syncDelayValues: ReadonlyArray<Preferences['syncDelaySeconds']> = [0, 10, 20, 30, 45, 60];

export const defaultPreferences: Preferences = {
  favoriteDriverId: null,
  syncDelaySeconds: 0,
  timezone: 'local',
  units: 'metric',
  reducedData: false,
  dismissedOnboarding: false
};

export function parsePreferences(value: unknown): Preferences {
  if (!isRecord(value)
    || !(value.favoriteDriverId === null || typeof value.favoriteDriverId === 'string')
    || !syncDelayValues.includes(value.syncDelaySeconds as Preferences['syncDelaySeconds'])
    || !(value.timezone === 'local' || value.timezone === 'circuit')
    || value.units !== 'metric'
    || typeof value.reducedData !== 'boolean'
    || typeof value.dismissedOnboarding !== 'boolean') {
    return defaultPreferences;
  }
  return {
    favoriteDriverId: value.favoriteDriverId,
    syncDelaySeconds: value.syncDelaySeconds as Preferences['syncDelaySeconds'],
    timezone: value.timezone,
    units: value.units,
    reducedData: value.reducedData,
    dismissedOnboarding: value.dismissedOnboarding
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
