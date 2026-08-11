import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';

const sessionId = 'session:replay:hungary-race-2026';
test.setTimeout(90_000);

test.beforeEach(async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error('Playwright baseURL is required');
  await context.addCookies([{
    name: 'f1c_replay_run',
    value: randomUUID(),
    url: baseURL,
    httpOnly: true,
    sameSite: 'Lax'
  }]);
  await controlReplay(context.request, { action: 'reset' });
  await page.goto('/weekend', { waitUntil: 'domcontentloaded' });
});

test('replay boots, persists favorite, and opens comparison', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Hungarian Grand Prix' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/REPLAY:OPENF1/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('table', { name: /current race order/i })).toBeVisible({ timeout: 15_000 });

  await page.goto('/settings');
  await page.getByLabel('Favorite driver').selectOption('driver:81:2026');
  await page.reload();
  await expect(page.getByLabel('Favorite driver')).toHaveValue('driver:81:2026');
  await page.goto('/weekend');
  await expect(page.getByText('YOUR DRIVER').locator('..')).toContainText('PIA');

  await page.locator('#battles').getByRole('link', { name: /compare drivers/i }).first().click();
  await expect(page).toHaveURL(/\/compare\?/);
  await expect(page.getByText('HEAD TO HEAD · CLEAN DATA')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('h1')).toContainText('vs');
});

test('strategy route exposes real analysis and active navigation', async ({ page }) => {
  await page.goto('/strategy');
  await expect(page.getByRole('heading', { name: /strategy analysis/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pace delta' })).toBeVisible();
  await expect(page.getByLabel('Primary driver')).toBeVisible();
  await expect(page.getByText(/Clean-lap pace/)).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Strategy' })).toHaveAttribute('aria-current', 'page');
});

test('replay exposes the real yellow-flag event without inventing a safety car', async ({ page, context }) => {
  await expect(page.locator('#battles').getByText(/Gap/).first()).toBeVisible();
  await controlReplay(context.request, { action: 'seek', atMs: 2100 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Yellow flag', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('YELLOW IN TRACK SECTOR 8', { exact: true })).toBeVisible();
});

test('replay reaches provisional post-race', async ({ page, context }) => {
  await controlReplay(context.request, { action: 'seek', atMs: 5000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('PROVISIONAL RESULT')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hungarian Grand Prix' })).toBeVisible();
  await expect(page.getByText(/Dutch Grand Prix/)).toBeVisible();
});

test('season directory exposes every 2026 circuit, driver, and team', async ({ page }) => {
  await page.goto('/season');
  await expect(page.getByRole('heading', { name: /season 2026/i })).toBeVisible();
  await expect(page.locator('.season-grid--circuits > li')).toHaveCount(25);
  await page.getByRole('link', { name: 'drivers', exact: true }).click();
  await expect(page.locator('.season-grid--drivers > li')).toHaveCount(22);
  await page.getByRole('link', { name: 'teams', exact: true }).click();
  await expect(page.locator('.season-grid--teams > li')).toHaveCount(11);
});

test('official circuit profile never labels a substitute drawing as verified', async ({ page }) => {
  await page.goto('/season/circuits/track%3Aopenf1%3A4');
  await expect(page.getByRole('heading', { name: 'Hungaroring' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Official circuit map' })).toBeVisible();
  await expect(page.getByText('verified', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /official formula 1 circuit map for hungaroring/i })).toBeVisible();
  await page.goto('/season/circuits/track%3Aopenf1%3A153');
  await expect(page.getByRole('heading', { name: 'Madring' })).toBeVisible();
  await expect(page.getByText('Official map unavailable', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /madring/i })).toHaveCount(0);
});

async function controlReplay(request: APIRequestContext, command: Record<string, string | number>) {
  const response = await request.post('/api/v1/replay/control', { data: { sessionId, ...command } });
  if (!response.ok()) throw new Error(`Replay control failed (${response.status()})`);
}
