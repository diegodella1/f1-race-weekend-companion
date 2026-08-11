import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.VISUAL_BASE_URL ?? 'http://127.0.0.1:3000';
const outputDir = process.env.VISUAL_OUTPUT_DIR ?? '/tmp/f1-visuals';
const cases = [
  { name: 'weekend-phone', path: '/weekend', viewport: { width: 393, height: 852 } },
  { name: 'strategy-phone', path: '/strategy', viewport: { width: 393, height: 852 } },
  { name: 'track-tablet', path: '/track', viewport: { width: 768, height: 1024 } },
  { name: 'compare-desktop', path: '/compare', viewport: { width: 1280, height: 900 } },
  { name: 'settings-small', path: '/settings', viewport: { width: 320, height: 700 } }
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const capture of cases) {
    const page = await browser.newPage({ viewport: capture.viewport, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}${capture.path}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForTimeout(750);
    await page.screenshot({ path: `${outputDir}/${capture.name}.png`, fullPage: true });
    await page.close();
  }
} finally {
  await browser.close();
}
