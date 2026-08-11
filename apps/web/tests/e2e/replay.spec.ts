import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';

const sessionId = 'session:replay:demo-race-2024';
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
  await expect(page.getByRole('heading', { name: 'Austrian GP' })).toBeVisible();
  await expect(page.getByText('DEMO REPLAY')).toBeVisible();
  await expect(page.getByRole('table', { name: /current race order/i })).toBeVisible();

  await page.goto('/settings');
  await page.getByLabel('Favorite driver').selectOption('driver:81:2024');
  await page.reload();
  await expect(page.getByLabel('Favorite driver')).toHaveValue('driver:81:2024');
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

test('VSC disables predictive widgets and explains status change', async ({ page, context }) => {
  await expect(page.locator('#battles').getByText(/Gap/).first()).toBeVisible();
  await controlReplay(context.request, { action: 'seek', atMs: 2100 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Virtual Safety Car', { exact: true }).first()).toBeVisible();
  await expect(page.locator('#battles')).toContainText('Predictions paused');
  await page.getByRole('button', { name: /what matters now/i }).click();
  await expect(page.getByRole('dialog')).toContainText('Virtual Safety Car');
});

test('replay reaches provisional post-race', async ({ page, context }) => {
  await controlReplay(context.request, { action: 'seek', atMs: 5000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('PROVISIONAL RESULT')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Austrian GP' })).toBeVisible();
  await expect(page.getByText(/British GP/)).toBeVisible();
});

async function controlReplay(request: APIRequestContext, command: Record<string, string | number>) {
  const response = await request.post('/api/v1/replay/control', { data: { sessionId, ...command } });
  if (!response.ok()) throw new Error(`Replay control failed (${response.status()})`);
}
