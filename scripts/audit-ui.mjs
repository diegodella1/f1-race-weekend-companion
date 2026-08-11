import { chromium } from '@playwright/test';
import axe from 'axe-core';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:3000';
const pages = ['/weekend', '/strategy', '/track', '/compare', '/settings'];
const viewports = [{ width: 320, height: 700 }, { width: 1280, height: 900 }];
const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  for (const viewport of viewports) {
    for (const path of pages) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.addScriptTag({ content: axe.source });
      const audit = await page.evaluate(async () => {
        const results = await globalThis.axe.run(document, { resultTypes: ['violations'] });
        return {
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          overflowSelectors: Array.from(document.querySelectorAll('body *')).flatMap((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.right <= document.documentElement.clientWidth + 1 && rect.left >= -1) return [];
            const name = element.tagName.toLowerCase();
            const detail = element.id ? `#${element.id}` : element.classList.length ? `.${Array.from(element.classList).join('.')}` : '';
            return [`${name}${detail} (${Math.round(rect.left)}..${Math.round(rect.right)})`];
          }).slice(0, 12),
          violations: results.violations.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.length
          }))
        };
      });
      const serious = audit.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
      if (audit.overflow || serious.length) failures.push({ path, viewport, overflow: audit.overflow, overflowSelectors: audit.overflowSelectors, violations: serious });
      console.log(`${viewport.width}px ${path}: ${audit.violations.length} axe finding(s), overflow=${audit.overflow}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
}
