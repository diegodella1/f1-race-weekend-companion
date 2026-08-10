import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { cookies } from 'next/headers';
import { SystemClock, type Meeting, type Track } from '@f1/domain';
import { OpenF1Adapter, ReplayAdapter, SessionEngine, type TimingProvider } from '@f1/providers';

export interface AppRuntime {
  provider: TimingProvider;
  replayAdapter: ReplayAdapter;
  engine: SessionEngine;
  meeting: Meeting;
  track: Track;
}

declare global {
  var __f1RuntimePromises: Map<string, Promise<AppRuntime>> | undefined;
}

const replayCookieName = 'f1c_replay_run';
const safeRunId = /^[a-f0-9-]{36}$/u;

function fixtureDirectory(): string {
  if (process.env.REPLAY_FIXTURE_DIR) return resolve(process.env.REPLAY_FIXTURE_DIR);
  const workspaceFixtureDirectory = resolve(process.cwd(), 'fixtures');
  return existsSync(workspaceFixtureDirectory) ? workspaceFixtureDirectory : resolve(process.cwd(), '../..', 'fixtures');
}

async function createRuntime(): Promise<AppRuntime> {
  const directory = fixtureDirectory();
  const clock = new SystemClock();
  const replayAdapter = await ReplayAdapter.create({
    fixturePath: resolve(directory, '2024-demo-race.json'),
    eventsPath: resolve(directory, '2024-demo-race.ndjson'),
    clock
  });
  let provider: TimingProvider = replayAdapter;
  let meeting = replayAdapter.getMeeting();
  let track = replayAdapter.getTrack();
  if (process.env.DATA_PROVIDER === 'openf1') {
    const liveProvider = new OpenF1Adapter({
      baseUrl: process.env.OPENF1_BASE_URL ?? 'https://api.openf1.org/v1',
      clock,
      ...(process.env.OPENF1_USERNAME ? { username: process.env.OPENF1_USERNAME } : {}),
      ...(process.env.OPENF1_PASSWORD ? { password: process.env.OPENF1_PASSWORD } : {}),
      ...(process.env.OPENF1_ACCESS_TOKEN ? { accessToken: process.env.OPENF1_ACCESS_TOKEN } : {})
    });
    try {
      const from = new Date(clock.now().getTime() - 4 * 24 * 60 * 60_000).toISOString();
      const to = new Date(clock.now().getTime() + 21 * 24 * 60 * 60_000).toISOString();
      const liveMeeting = (await liveProvider.getMeetings({ from, to }))[0];
      if (liveMeeting) {
        provider = liveProvider;
        meeting = liveMeeting;
        track = {
          id: liveMeeting.circuitId,
          name: liveMeeting.circuitName,
          countryCode: liveMeeting.countryCode,
          lengthKm: null,
          laps: null,
          pitLossSec: null,
          drsZones: [],
          sectors: [],
          layoutPath: null
        };
      }
    } catch (error) {
      console.warn('OpenF1 startup failed; replay remains available', error instanceof Error ? error.message : 'Unknown provider error');
    }
  }
  return { provider, replayAdapter, engine: new SessionEngine(provider, clock), meeting, track };
}

export function getRuntime(runId = 'default'): Promise<AppRuntime> {
  const key = process.env.DATA_PROVIDER === 'openf1' ? 'live' : runId;
  const runtimes = globalThis.__f1RuntimePromises ??= new Map();
  const existing = runtimes.get(key);
  if (existing) return existing;
  if (runtimes.size >= 100) {
    const oldest = runtimes.keys().next().value as string | undefined;
    if (oldest && oldest !== 'live') runtimes.delete(oldest);
  }
  const runtime = createRuntime();
  runtimes.set(key, runtime);
  return runtime;
}

export function getRequestRuntime(request: Request): Promise<AppRuntime> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const runId = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${replayCookieName}=`))?.slice(replayCookieName.length + 1);
  return getRuntime(runId && safeRunId.test(runId) ? runId : 'default');
}

export async function getServerRuntime(): Promise<AppRuntime> {
  const runId = (await cookies()).get(replayCookieName)?.value;
  return getRuntime(runId && safeRunId.test(runId) ? runId : 'default');
}
