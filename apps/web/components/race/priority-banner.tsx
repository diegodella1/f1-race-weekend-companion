'use client';

import { useState } from 'react';
import type { RaceControlEvent } from '@f1/domain';

export function PriorityBanner({ event }: { event: RaceControlEvent | undefined }) {
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  if (!event || event.id === dismissedId) return null;
  return <div className="priority-banner" role="status"><b>{event.label}</b><span>{event.sourceText}</span><button type="button" onClick={() => setDismissedId(event.id)} aria-label="Dismiss race-control banner">×</button></div>;
}
