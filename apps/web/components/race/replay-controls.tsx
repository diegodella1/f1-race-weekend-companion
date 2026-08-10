'use client';

import { useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { trackEvent } from '@/lib/client/analytics';

export function ReplayControls({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 4 | 16>(1);
  const [pending, startTransition] = useTransition();

  function control(body: Record<string, string | number>) {
    startTransition(async () => {
      const response = await fetch('/api/v1/replay/control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, ...body })
      });
      if (response.ok) await queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    });
  }
  function togglePlay() {
    const next = !playing;
    setPlaying(next);
    control({ action: next ? 'play' : 'pause' });
    if (next) trackEvent('replay_started');
  }
  function changeSpeed(next: 1 | 4 | 16) {
    setSpeed(next);
    control({ action: 'speed', speed: next });
  }
  return (
    <div className="replay-controls" aria-label="Replay controls">
      <span>DEMO REPLAY</span>
      <button type="button" onClick={togglePlay} disabled={pending}>{playing ? 'Pause' : 'Play'}</button>
      {[1, 4, 16].map((value) => <button key={value} type="button" className={speed === value ? 'active' : undefined} onClick={() => changeSpeed(value as 1 | 4 | 16)}>{value}×</button>)}
      <button type="button" onClick={() => { setPlaying(false); control({ action: 'reset' }); }}>Reset</button>
    </div>
  );
}
