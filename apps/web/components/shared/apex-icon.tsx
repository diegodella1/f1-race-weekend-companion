import type { ReactNode } from 'react';

export type ApexIconName = 'dashboard' | 'track' | 'strategy' | 'favorite' | 'settings' | 'speed' | 'warning' | 'weather' | 'timer' | 'compare';

const paths: Record<ApexIconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  track: <><path d="M4 5.5 9 3l6 3 5-2v14.5L15 21l-6-3-5 2z"/><path d="M9 3v15M15 6v15"/></>,
  strategy: <><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h5a3 3 0 0 1 3 3v1M16 14v-4M13 13l3 3 3-3"/></>,
  favorite: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  speed: <><path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 13 4-4M7 17h10"/></>,
  warning: <><path d="M12 3 2.8 20h18.4z"/><path d="M12 9v5M12 17.5v.1"/></>,
  weather: <><path d="M7 17h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.2 2A3 3 0 0 0 7 17Z"/><path d="M5 4 3.5 2.5M19 4l1.5-1.5M12 3V1"/></>,
  timer: <><circle cx="12" cy="13" r="8"/><path d="M9 2h6M12 5V2M12 13l3-2"/></>,
  compare: <><path d="M7 7h13M17 4l3 3-3 3M17 17H4M7 14l-3 3 3 3"/></>
};

export function ApexIcon({ name, className }: { name: ApexIconName; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
