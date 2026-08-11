import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FakeClock } from '@f1/domain';
import { ReplayAdapter } from '../replay';

const fixturePath = resolve(process.cwd(), 'fixtures/2026-hungary-race.json');
const eventsPath = resolve(process.cwd(), 'fixtures/2026-hungary-race.ndjson');
const sessionId = 'session:replay:hungary-race-2026';

describe('ReplayAdapter', () => {
  it('loads a complete deterministic race fixture', async () => {
    const clock = new FakeClock(new Date('2026-07-26T14:04:00.000Z'));
    const adapter = await ReplayAdapter.create({ fixturePath, eventsPath, clock });

    const snapshot = await adapter.getSessionSnapshot(sessionId);

    expect(snapshot.drivers).toHaveLength(22);
    expect(snapshot.drivers.flatMap((driver) => driver.laps)).toHaveLength(264);
    expect(snapshot.drivers.flatMap((driver) => driver.laps).some((lap) => lap.isPitOut)).toBe(true);
    expect(snapshot.drivers.find((driver) => driver.code === 'BOT')?.status).toBe('retired');
    expect(snapshot.drivers.find((driver) => driver.code === 'PIA')?.status).toBe('running');
    const timedLap = snapshot.drivers.flatMap((driver) => driver.laps).find((lap) => lap.timeSec !== null && lap.sectorsSec.every((sector) => sector !== null));
    expect(timedLap?.sectorsSec).not.toEqual(timedLap?.timeSec === null || timedLap?.timeSec === undefined
      ? []
      : [timedLap.timeSec * 0.32, timedLap.timeSec * 0.36, timedLap.timeSec * 0.32]);
    expect(snapshot.phase).toBe('live');
  });

  it('applies replay events against injected time', async () => {
    const clock = new FakeClock(new Date('2026-07-26T14:04:00.000Z'));
    const adapter = await ReplayAdapter.create({ fixturePath, eventsPath, clock });
    adapter.play();
    clock.advance(2_100);

    const snapshot = await adapter.getSessionSnapshot(sessionId);

    expect(snapshot.trackStatus.code).toBe('YELLOW');
    expect(snapshot.raceControl.at(-1)?.sourceText).toBe('YELLOW IN TRACK SECTOR 8');
  });

  it('seeks and resets without depending on Date.now', async () => {
    const clock = new FakeClock(new Date('2026-07-26T14:04:00.000Z'));
    const adapter = await ReplayAdapter.create({ fixturePath, eventsPath, clock });
    adapter.seek(5_100);
    expect((await adapter.getSessionSnapshot(sessionId)).phase).toBe('finished_provisional');
    adapter.reset();
    expect((await adapter.getSessionSnapshot(sessionId)).phase).toBe('live');
  });

  it('exposes replay capabilities without claiming unavailable telemetry', async () => {
    const adapter = await ReplayAdapter.create({
      fixturePath,
      eventsPath,
      clock: new FakeClock(new Date('2026-07-26T14:04:00.000Z'))
    });
    expect(adapter.capabilities()).toMatchObject({
      gaps: true,
      sectors: true,
      weather: false,
      finalClassification: true,
      livePush: false
    });
  });
});
