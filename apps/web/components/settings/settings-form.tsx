'use client';

import type { DriverState, Preferences } from '@f1/domain';
import { usePreferences } from '@/lib/client/preferences';
import { trackEvent } from '@/lib/client/analytics';

const delays: Preferences['syncDelaySeconds'][] = [0, 10, 20, 30, 45, 60];

export function SettingsForm({ drivers }: { drivers: DriverState[] }) {
  const favoriteDriverId = usePreferences((state) => state.favoriteDriverId);
  const syncDelaySeconds = usePreferences((state) => state.syncDelaySeconds);
  const timezone = usePreferences((state) => state.timezone);
  const reducedData = usePreferences((state) => state.reducedData);
  const setFavoriteDriverId = usePreferences((state) => state.setFavoriteDriverId);
  const setSyncDelaySeconds = usePreferences((state) => state.setSyncDelaySeconds);
  const setTimezone = usePreferences((state) => state.setTimezone);
  const setReducedData = usePreferences((state) => state.setReducedData);
  return (
    <form className="settings-form">
      <label><span>Favorite driver</span><select value={favoriteDriverId ?? ''} onChange={(event) => { const value = event.target.value || null; setFavoriteDriverId(value); trackEvent('favorite_driver_selected'); }}><option value="">None selected</option>{drivers.map((driver) => <option key={driver.driverId} value={driver.driverId}>{driver.code} · {driver.fullName}</option>)}</select></label>
      <fieldset><legend>Broadcast sync delay</legend><div className="segmented-control">{delays.map((delay) => <button type="button" className={delay === syncDelaySeconds ? 'active' : undefined} key={delay} onClick={() => { setSyncDelaySeconds(delay); trackEvent('sync_delay_changed', { seconds: delay }); }}>{delay}s</button>)}</div><p>Leaderboard, race control and Explain use same delayed clock.</p></fieldset>
      <fieldset><legend>Time zone</legend><div className="segmented-control"><button type="button" className={timezone === 'local' ? 'active' : undefined} onClick={() => setTimezone('local')}>Local</button><button type="button" className={timezone === 'circuit' ? 'active' : undefined} onClick={() => setTimezone('circuit')}>Circuit</button></div></fieldset>
      <label className="toggle-row"><span><b>Reduced data</b><small>Prefer fewer visual updates on unstable networks.</small></span><input type="checkbox" checked={reducedData} onChange={(event) => setReducedData(event.target.checked)} /></label>
    </form>
  );
}
