import { beforeEach, describe, expect, it } from 'vitest';
import { GET as getSnapshot } from '../sessions/[id]/snapshot/route';
import { GET as getDataHealth } from '../health/data/route';
import { POST as controlReplay } from '../replay/control/route';

const sessionId = 'session:replay:demo-race-2024';

describe('BFF integration', () => {
  beforeEach(async () => {
    await controlReplay(new Request('http://localhost/api/v1/replay/control', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', sessionId })
    }));
  });

  it('returns a normalized derived snapshot', async () => {
    const response = await getSnapshot(
      new Request(`http://localhost/api/v1/sessions/${sessionId}/snapshot?delay=0&favorite=driver%3A81%3A2024`),
      { params: Promise.resolve({ id: sessionId }) }
    );
    const snapshot = await response.json();
    expect(response.status).toBe(200);
    expect(snapshot.drivers).toHaveLength(8);
    expect(snapshot.battles[0].behindDriverId).toBe('driver:81:2024');
  });

  it('rejects inconsistent delay values using public error shape', async () => {
    const response = await getSnapshot(
      new Request(`http://localhost/api/v1/sessions/${sessionId}/snapshot?delay=13`),
      { params: Promise.resolve({ id: sessionId }) }
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_DELAY', retryable: false });
  });

  it('primes a new replay runtime before reporting data health', async () => {
    const response = await getDataHealth(new Request('http://localhost/api/v1/health/data', {
      headers: { cookie: `f1c_replay_run=${crypto.randomUUID()}` }
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ provider: 'replay', state: 'fresh' });
  });
});
