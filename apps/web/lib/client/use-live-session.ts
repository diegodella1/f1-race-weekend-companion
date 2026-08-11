'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DataHealth, SessionPatch, SessionSnapshot } from '@f1/domain';
import { canReuseSnapshotPayload, parseDataHealthPayload, parseSessionSnapshotPayload } from './live-payload';
import { applySessionPatch } from './session-patch';
import { usePreferences } from './preferences';

async function fetchSnapshot(sessionId: string, delay: number, favoriteDriverId: string | null): Promise<SessionSnapshot> {
  const params = new URLSearchParams({ delay: String(delay) });
  if (favoriteDriverId) params.set('favorite', favoriteDriverId);
  const response = await fetch(`/api/v1/sessions/${encodeURIComponent(sessionId)}/snapshot?${params}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Snapshot request failed (${response.status})`);
  const snapshot = parseSessionSnapshotPayload(await response.json());
  if (!snapshot) throw new Error('Snapshot response failed validation');
  return snapshot;
}

export function useLiveSession(sessionId: string, initialData: SessionSnapshot) {
  const queryClient = useQueryClient();
  const favoriteDriverId = usePreferences((state) => state.favoriteDriverId);
  const delay = usePreferences((state) => state.syncDelaySeconds);
  const [streamHealthState, setStreamHealthState] = useState<DataHealth['state'] | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const queryKey = useMemo(() => ['session', sessionId, delay, favoriteDriverId] as const, [delay, favoriteDriverId, sessionId]);
  const query = useQuery({
    queryKey,
    queryFn: () => fetchSnapshot(sessionId, delay, favoriteDriverId),
    initialData,
    staleTime: 10_000,
    refetchInterval: streamConnected ? false : 10_000,
    retry: 2
  });

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ delay: String(delay) });
    if (favoriteDriverId) params.set('favorite', favoriteDriverId);
    const source = new EventSource(`/api/v1/sessions/${encodeURIComponent(sessionId)}/stream?${params}`);
    const onSnapshot = (event: MessageEvent<string>) => {
      let payload: unknown;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      const current = queryClient.getQueryData<SessionSnapshot>(queryKey);
      if (current && canReuseSnapshotPayload(payload, current, delay, favoriteDriverId)) {
        setStreamConnected(true);
        return;
      }
      const snapshot = parseSessionSnapshotPayload(payload);
      if (!active || !snapshot) return;
      queryClient.setQueryData(queryKey, snapshot);
      setStreamConnected(true);
    };
    const onPatch = (event: MessageEvent<string>) => {
      const patch = JSON.parse(event.data) as SessionPatch;
      const current = queryClient.getQueryData<SessionSnapshot>(queryKey);
      if (!current) return;
      const updated = applySessionPatch(current, patch);
      if (updated) queryClient.setQueryData(queryKey, updated);
      else void queryClient.invalidateQueries({ queryKey });
    };
    const onHealth = (event: MessageEvent<string>) => {
      let payload: unknown;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      const health = parseDataHealthPayload(payload);
      if (health) setStreamHealthState(health.state);
    };
    source.addEventListener('snapshot', onSnapshot as EventListener);
    source.addEventListener('patch', onPatch as EventListener);
    source.addEventListener('health', onHealth as EventListener);
    source.onerror = () => setStreamConnected(false);
    return () => {
      active = false;
      source.close();
    };
  }, [delay, favoriteDriverId, queryClient, queryKey, sessionId]);

  return { ...query, streamHealthState, streamConnected };
}
