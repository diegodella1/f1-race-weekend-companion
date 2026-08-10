import { preferencesSchema, type Preferences } from './models';

export const defaultPreferences: Preferences = {
  favoriteDriverId: null,
  syncDelaySeconds: 0,
  timezone: 'local',
  units: 'metric',
  reducedData: false,
  dismissedOnboarding: false
};

export function parsePreferences(value: unknown): Preferences {
  const result = preferencesSchema.safeParse(value);
  return result.success ? result.data : defaultPreferences;
}
