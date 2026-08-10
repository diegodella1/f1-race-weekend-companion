'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dataHealthSchema, sessionSnapshotSchema, type DataHealth, type SessionPatch, type SessionSnapshot } from '@f1/domain';
import { applySessionPatch } from './session-patch';
import { usePreferences } from './preferences';

async function fetchSnapshot(sessionId: string, delay: number, favoriteDriverId: string | null): Promise<SessionSnapshot> {
  const params = new URLSearchParams({ delay: String(delay) });
  if (favoriteDriverId) params.set('favorite', favoriteDriverId);
  const response = await fetch(`/api/v1/sessions/${encodeURIComponent(sessionId)}/snapshot?${params}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Snapshot request failed (${response.status})`);
  return sessionSnapshotSchema.parse(await response.json());
}

export function useLiveSession(sessionId: string, initialData: SessionSnapshot) {
  const queryClient = useQueryClient();
  const favoriteDriverId = usePreferences((state) => state.favoriteDriverId);
  const delay = usePreferences((state) => state.syncDelaySeconds);
  const [streamHealth, setStreamHealth] = useState<DataHealth | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const queryKey = useMemo(() => ['session', sessionId, delay, favoriteDriverId] as const, [delay, favoriteDriverId, sessionId]);
  const query = useQuery({
    queryKey,
    queryFn: () => fetchSnapshot(sessionId, delay, favoriteDriverId),
    initialData,
    refetchInterval: 10_000,
    retry: 2
  });

  useEffect(() => {
    const params = new URLSearchParams({ delay: String(delay) });
    if (favoriteDriverId) params.set('favorite', favoriteDriverId);
    const source = new EventSource(`/api/v1/sessions/${encodeURIComponent(sessionId)}/stream?${params}`);
    const onSnapshot = (event: MessageEvent<string>) => {
      const result = sessionSnapshotSchema.safeParse(JSON.parse(event.data));
      if (result.success) queryClient.setQueryData(queryKey, result.data);
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
      const result = dataHealthSchema.safeParse(JSON.parse(event.data));
      if (result.success) setStreamHealth(result.data);
    };
    source.addEventListener('snapshot', onSnapshot as EventListener);
    source.addEventListener('patch', onPatch as EventListener);
    source.addEventListener('health', onHealth as EventListener);
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [delay, favoriteDriverId, queryClient, queryKey, sessionId]);

  return { ...query, streamHealth, streamConnected };
}
