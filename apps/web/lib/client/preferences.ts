'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { defaultPreferences, parsePreferences, type Preferences } from '@f1/domain';

interface PreferenceStore extends Preferences {
  setFavoriteDriverId(driverId: string | null): void;
  setSyncDelaySeconds(delay: Preferences['syncDelaySeconds']): void;
  setTimezone(timezone: Preferences['timezone']): void;
  setReducedData(reducedData: boolean): void;
}

export const usePreferences = create<PreferenceStore>()(
  persist(
    (set) => ({
      ...defaultPreferences,
      setFavoriteDriverId: (favoriteDriverId) => set({ favoriteDriverId }),
      setSyncDelaySeconds: (syncDelaySeconds) => set({ syncDelaySeconds }),
      setTimezone: (timezone) => set({ timezone }),
      setReducedData: (reducedData) => set({ reducedData })
    }),
    {
      name: 'f1c:prefs:v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({
        favoriteDriverId,
        syncDelaySeconds,
        timezone,
        units,
        reducedData,
        dismissedOnboarding
      }) => ({ favoriteDriverId, syncDelaySeconds, timezone, units, reducedData, dismissedOnboarding }),
      merge: (persisted, current) => ({ ...current, ...parsePreferences(persisted) })
    }
  )
);
