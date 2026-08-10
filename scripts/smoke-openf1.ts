import { FakeClock } from '@f1/domain';
import { OpenF1Adapter } from '@f1/providers';

const sessionKey = process.env.OPENF1_SMOKE_SESSION ?? '9165';
const adapter = new OpenF1Adapter({
  baseUrl: process.env.OPENF1_BASE_URL ?? 'https://api.openf1.org/v1',
  clock: new FakeClock(new Date()),
  ...(process.env.OPENF1_USERNAME ? { username: process.env.OPENF1_USERNAME } : {}),
  ...(process.env.OPENF1_PASSWORD ? { password: process.env.OPENF1_PASSWORD } : {}),
  ...(process.env.OPENF1_ACCESS_TOKEN ? { accessToken: process.env.OPENF1_ACCESS_TOKEN } : {})
});

const snapshot = await adapter.getHistoricalSession(`session:openf1:${sessionKey}`);
if (snapshot.drivers.length === 0 || snapshot.lap === null) {
  throw new Error('OpenF1 smoke returned no classified drivers or laps');
}
console.log(JSON.stringify({
  provider: snapshot.meta.provider,
  sessionId: snapshot.id,
  kind: snapshot.kind,
  phase: snapshot.phase,
  lap: snapshot.lap,
  drivers: snapshot.drivers.length,
  raceControlEvents: snapshot.raceControl.length
}));
