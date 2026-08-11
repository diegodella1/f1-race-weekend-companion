import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { seasonCatalogSchema, type CircuitProfile, type DriverProfile, type SeasonCatalog, type TeamProfile } from '@f1/domain';
import { syncSeasonCatalog } from '@f1/providers';

const refreshIntervalMs = 24 * 60 * 60_000;

interface CatalogCache {
  catalog: SeasonCatalog;
  expiresAt: number;
  syncPromise: Promise<void> | null;
}

declare global {
  var __f1SeasonCatalogCache: CatalogCache | undefined;
}

export async function getSeasonCatalog(): Promise<SeasonCatalog> {
  const cache = globalThis.__f1SeasonCatalogCache ??= {
    catalog: await readFallbackCatalog(),
    expiresAt: 0,
    syncPromise: null
  };
  if (syncDisabled() || cache.expiresAt > Date.now()) return cache.catalog;
  startBackgroundSync(cache);
  return cache.catalog;
}

export async function getCircuitProfile(id: string): Promise<CircuitProfile | null> {
  return (await getSeasonCatalog()).circuits.find((circuit) => circuit.id === id) ?? null;
}

export async function getDriverProfile(id: string): Promise<DriverProfile | null> {
  return (await getSeasonCatalog()).drivers.find((driver) => driver.id === id) ?? null;
}

export async function getTeamProfile(id: string): Promise<TeamProfile | null> {
  return (await getSeasonCatalog()).teams.find((team) => team.id === id) ?? null;
}

function startBackgroundSync(cache: CatalogCache): void {
  if (cache.syncPromise) return;
  cache.expiresAt = Date.now() + refreshIntervalMs;
  cache.syncPromise = syncSeasonCatalog(cache.catalog, {
    ...(process.env.OPENF1_BASE_URL ? { baseUrl: process.env.OPENF1_BASE_URL } : {}),
    now: new Date()
  }).then((catalog) => {
    cache.catalog = catalog;
  }).catch((error: unknown) => {
    console.warn('2026 catalog sync failed; versioned fallback remains active', error instanceof Error ? error.message : 'Unknown catalog error');
  }).finally(() => {
    cache.syncPromise = null;
  });
}

async function readFallbackCatalog(): Promise<SeasonCatalog> {
  const directory = process.env.REPLAY_FIXTURE_DIR
    ? resolve(process.env.REPLAY_FIXTURE_DIR)
    : fixtureDirectory();
  return seasonCatalogSchema.parse(JSON.parse(await readFile(resolve(directory, 'season-2026.json'), 'utf8')));
}

function fixtureDirectory(): string {
  const workspaceDirectory = resolve(process.cwd(), 'fixtures');
  return existsSync(workspaceDirectory) ? workspaceDirectory : resolve(process.cwd(), '../..', 'fixtures');
}

function syncDisabled(): boolean {
  return process.env.SEASON_CATALOG_SYNC === 'off' || process.env.NODE_ENV === 'test';
}
