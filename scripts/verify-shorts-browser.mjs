import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from '../.verification/browser/node_modules/playwright/index.mjs';
const script = readFileSync('deploy/production/shorts-browser.js', 'utf8');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext();
  const events = [];
  await context.route('https://www.shortsblockerkids.de/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/website-events') {
      events.push(...JSON.parse(route.request().postData()).events);
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"accepted":1}' });
    }
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><a href="/support/">Support</a><button class="mock-primary">Preview</button><script>' + script + '</script>' });
  });
  const page = await context.newPage();
  await page.goto('https://www.shortsblockerkids.de/', { referer: 'https://example.org/from?private=value' });
  await page.getByRole('button', { name: 'Preview' }).click();
  await Promise.all([page.waitForURL('**/support/'), page.getByRole('link', { name: 'Support' }).click()]);
  await page.waitForLoadState('networkidle');
  assert.equal(events.filter(event => event.event_name === 'page_view').length, 2);
  assert.equal(events.filter(event => event.event_name === 'element_click').length, 2);
  assert.equal(new Set(events.map(event => event.session_id)).size, 1);
  assert.equal(new Set(events.map(event => event.visitor_id)).size, 1);
  assert.ok(events.every(event => event.referrer_host === 'example.org'));
  assert.ok(!JSON.stringify(events).includes('private'));
  assert.ok(events.some(event => event.element_id === 'support'));
  assert.ok(events.some(event => event.element_id === 'preview_primary'));
  assert.ok(events.some(event => event.event_name === 'page_leave'));
  await context.close();
  console.log('SHORTS_BROWSER_OK page_views=2 clicks=2 navigation_delivery=true source_redacted=true');
} finally { await browser.close(); }
