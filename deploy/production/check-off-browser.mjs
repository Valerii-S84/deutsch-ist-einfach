import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(resolve('.verification/browser/node_modules/playwright/index.mjs')));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests = [];
  page.on('request', request => {
    if (request.method() === 'POST' && /\/api\/public\/(?:website-analytics|analytics)\/events/.test(request.url())) requests.push(request.url());
  });
  await page.goto('https://deutschmit.de/', { waitUntil: 'networkidle' });
  if (!await page.getByRole('button', { name: 'Analytics erlauben', exact: true }).isVisible()) {
    await page.getByRole('button', { name: 'Analytics-Einstellungen', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Analytics erlauben', exact: true }).click();
  await page.goto('https://deutschmit.de/wissen', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  assert.equal(requests.length, 0, 'off image must not send analytics after consent/navigation/scroll');
  console.log('OFF_BROWSER_TRACKING_DISABLED_OK');
} finally { await browser.close(); }
