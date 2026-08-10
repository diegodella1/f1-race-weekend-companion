import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FakeClock } from '@f1/domain';
import { ReplayAdapter } from '../replay';

const fixturePath = resolve(process.cwd(), 'fixtures/2024-demo-race.json');
const eventsPath = resolve(process.cwd(), 'fixtures/2024-demo-race.ndjson');

describe('ReplayAdapter', () => {
  it('loads a complete deterministic race fixture', async () => {
    const clock = new FakeClock(new Date('2024-06-30T14:02:00.000Z'));
    const adapter = await ReplayAdapter.create({ fixturePath, eventsPath, clock });

    const snapshot = await adapter.getSessionSnapshot('session:replay:demo-race-2024');

    expect(snapshot.drivers).toHaveLength(8);
    expect(snapshot.drivers.every((driver) => driver.laps.length >= 12)).toBe(true);
    expect(snapshot.drivers.flatMap((driver) => driver.laps).some((lap) => lap.isPitOut)).toBe(true);
    expect(snapshot.phase).toBe('live');
  });

  it('applies replay events against injected time', async () => {
    const clock = new FakeClock(new Date('2024-06-30T14:02:00.000Z'));
    const adapter = await ReplayAdapter.create({ fixturePath, eventsPath, clock });
    adapter.play();
    clock.advance(2_100);

    const snapshot = await adapter.getSessionSnapshot('session:replay:demo-race-2024');

    expect(snapshot.trackStatus.code).toBe('VSC');
    expect(snapshot.raceControl.at(-1)?.sourceText).toContain('VIRTUAL SAFETY CAR');
  });

  it('seeks and resets without depending on Date.now', async () => {
    const clock = new FakeClock(new Date('2024-06-30T14:02:00.000Z'));
    const adapter = await ReplayAdapter.create({ fixturePath, eventsPath, clock });
    adapter.seek(5_100);
    expect((await adapter.getSessionSnapshot('session:replay:demo-race-2024')).phase).toBe('finished_provisional');
    adapter.reset();
    expect((await adapter.getSessionSnapshot('session:replay:demo-race-2024')).phase).toBe('live');
  });

  it('exposes replay capabilities without claiming unavailable telemetry', async () => {
    const adapter = await ReplayAdapter.create({
      fixturePath,
      eventsPath,
      clock: new FakeClock(new Date('2024-06-30T14:02:00.000Z'))
    });
    expect(adapter.capabilities()).toMatchObject({
      gaps: true,
      sectors: true,
      weather: false,
      livePush: false
    });
  });
});
