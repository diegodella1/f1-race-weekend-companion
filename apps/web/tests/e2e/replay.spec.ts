import { expect, test, type Page } from '@playwright/test';

const sessionId = 'session:replay:demo-race-2024';
test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await page.goto('/weekend');
  await controlReplay(page, { action: 'reset' });
  await page.reload();
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
  await expect(page.getByText('DRIVER COMPARE')).toBeVisible();
  await expect(page.locator('h1')).toContainText('vs');
});

test('VSC disables predictive widgets and explains status change', async ({ page }) => {
  await expect(page.locator('#battles').getByText(/Gap/).first()).toBeVisible();
  await controlReplay(page, { action: 'seek', atMs: 2100 });
  await page.reload();
  await expect(page.getByText('Virtual Safety Car', { exact: true }).first()).toBeVisible();
  await expect(page.locator('#battles')).toContainText('Predictions paused');
  await page.getByRole('button', { name: /what matters now/i }).click();
  await expect(page.getByRole('dialog')).toContainText('Virtual Safety Car');
});

test('replay reaches provisional post-race', async ({ page }) => {
  await controlReplay(page, { action: 'seek', atMs: 5000 });
  await page.reload();
  await expect(page.getByText('PROVISIONAL RESULT')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Austrian GP' })).toBeVisible();
  await expect(page.getByText(/British GP/)).toBeVisible();
});

async function controlReplay(page: Page, command: Record<string, string | number>) {
  await page.evaluate(async ({ sessionId: id, command: replayCommand }) => {
    const response = await fetch('/api/v1/replay/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, ...replayCommand })
    });
    if (!response.ok) throw new Error(`Replay control failed (${response.status})`);
  }, { sessionId, command });
}
