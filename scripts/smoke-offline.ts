import { chromium } from '@playwright/test';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/weekend`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  const cdp = await context.newCDPSession(page);
  const manifest = await cdp.send('Page.getAppManifest');
  if (manifest.errors.length > 0) {
    throw new Error(`Manifest errors: ${manifest.errors.map((error) => error.message).join('; ')}`);
  }
  const installability = await cdp.send('Page.getInstallabilityErrors');
  if (installability.installabilityErrors.length > 0) {
    throw new Error(`Installability errors: ${installability.installabilityErrors.map((error) => error.errorId).join(', ')}`);
  }
  await page.evaluate(async () => {
    const response = await fetch('/api/v1/sessions/session%3Areplay%3Ademo-race-2024/snapshot');
    if (!response.ok) throw new Error(`Snapshot warm-up failed (${response.status})`);
  });

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#leaderboard-title').waitFor({ state: 'visible' });
  const drivers = await page.locator('.leaderboard tbody tr').count();
  if (drivers < 8) throw new Error(`Offline timing tower rendered only ${drivers} drivers`);

  console.log(JSON.stringify({ installable: true, offline: true, shell: true, cachedDrivers: drivers }));
} finally {
  await browser.close();
}
