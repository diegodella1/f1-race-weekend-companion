export type AnalyticsEvent =
  | 'app_opened'
  | 'session_view_started'
  | 'mode_viewed'
  | 'favorite_driver_selected'
  | 'battle_opened'
  | 'driver_detail_opened'
  | 'driver_compare_opened'
  | 'explain_opened'
  | 'sync_delay_changed'
  | 'data_state_changed'
  | 'replay_started';

export function trackEvent(event: AnalyticsEvent, properties: Record<string, string | number | boolean> = {}): void {
  if (process.env.NEXT_PUBLIC_ENABLE_ANALYTICS !== 'true' || navigator.doNotTrack === '1') return;
  const host = process.env.NEXT_PUBLIC_ANALYTICS_HOST;
  if (!host) return;
  const body = JSON.stringify({ event, properties });
  navigator.sendBeacon(host, new Blob([body], { type: 'application/json' }));
}
