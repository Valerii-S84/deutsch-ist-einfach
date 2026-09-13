import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chromium } from '../../.verification/browser/node_modules/playwright/index.mjs';

const base = 'https://deutschmit.de';
const visitor = '9c4dca54-f89b-4bf6-a920-151958810abc';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const result = { passed: false, automatic: {}, historical: {}, reports: {} };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(id => {
    if (!localStorage.getItem('deutschmit_analytics_visitor_v2')) localStorage.setItem('deutschmit_analytics_visitor_v2', JSON.stringify({ id, created: Date.now() }));
    document.addEventListener('click', event => {
      const link = event.target instanceof Element ? event.target.closest('a') : null;
      if (link?.href.startsWith('https://t.me/')) event.preventDefault();
    }, true);
  }, visitor);
  const page = await context.newPage();
  const names = new Set();
  page.on('request', request => {
    if (request.url() === base + '/api/public/analytics/events') {
      try { for (const event of JSON.parse(request.postData() ?? '{}').events ?? []) names.add(event.event_name); } catch {}
    }
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[role="dialog"]').count(), 0, 'no initial consent banner');
  assert.equal(await page.evaluate(() => localStorage.getItem('deutschmit_analytics_consent_v2')), null, 'no fabricated consent');
  await page.locator('a[href^="https://t.me/"]').first().click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.locator('#quiz-teaser button').first().click();
  for (let question = 0; question < 5; question++) {
    await page.locator('button[aria-pressed="false"]:visible').first().click();
    if (question < 4) await page.getByRole('button', { name: 'Nächste Frage', exact: true }).click();
  }
  await page.goto(base + '/contact', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Unverbindliche Lernanfrage starten', exact: true }).click();
  await page.goto(base, { waitUntil: 'networkidle' });
  for (const name of ['session_start', 'page_view', 'element_click', 'scroll_depth', 'quiz_started', 'quiz_completed', 'form_open']) assert.ok(names.has(name), 'automatic ' + name);
  result.automatic = { noBanner: true, noFabricatedConsent: true, events: [...names], submittedContacts: 0 };

  // Existing authorized owner credentials stay in memory, never in output or files.
  const owner = JSON.parse(execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=12', '-o', 'StrictHostKeyChecking=yes', 'root@46.225.181.45',
    "docker exec quiz-arena-site-frontend-1 node -e 'process.stdout.write(JSON.stringify({email:process.env.SITE_ADMIN_EMAIL,password:process.env.SITE_ADMIN_PASSWORD}))'"], { encoding: 'utf8', timeout: 20000 }));
  const login = await context.request.post(base + '/api/admin/login', { headers: { Origin: base }, data: owner });
  assert.equal(login.status(), 200);
  const quizLogin = await context.request.post(base + '/api/admin/quiz-arena/auth/login', { headers: { Origin: base }, data: owner });
  owner.password = '';
  assert.equal(quizLogin.status(), 200);
  assert.equal((await quizLogin.json()).requires_2fa, false, 'existing login configuration unchanged');
  const historyResponse = page.waitForResponse(response => response.url().includes('/api/admin/quiz-arena/website-analytics/overview') && response.ok());
  await page.goto(base + '/admin/dashboard', { waitUntil: 'networkidle' });
  const history = await (await historyResponse).json();
  for (const [label, value] of [['Website Besucher', history.totals.unique_visitors_total], ['Seitenaufrufe', history.totals.page_views_total], ['Telegram Klicks', history.totals.telegram_cta_clicks_total]]) {
    const article = page.locator('article').filter({ has: page.getByText(label, { exact: true }) });
    assert.ok((await article.innerText()).includes(value.toLocaleString('de-DE')), 'historical UI ' + label);
  }
  result.historical = { days: history.days, totals: history.totals, uiVerified: true };
  for (const name of ['overview', 'sessions', 'pages', 'events', 'traffic', 'conversions']) {
    const response = await context.request.get(base + '/api/admin/analytics/deutschmit/' + name + '?days=90');
    assert.equal(response.status(), 200, name);
    result.reports[name] = name === 'overview' ? (await response.json()).totals : '200';
  }
  const reportLoaded = page.waitForResponse(response => response.url().includes('/api/admin/analytics/deutschmit/overview') && response.ok());
  await page.goto(base + '/admin/deutschmit/overview', { waitUntil: 'networkidle' });
  await reportLoaded;
  await page.screenshot({ path: '.verification/analytics-release/statistics-fixed-overview.png', fullPage: true });
  const contacts = await (await context.request.get(base + '/api/admin/contact-requests')).json();
  const tests = await (await context.request.get(base + '/api/admin/contact-requests?scope=test')).json();
  assert.equal(tests.total, 1);
  result.contacts = { production: contacts.total, tests: tests.total };
  result.passed = true;
} finally {
  await browser.close();
  writeFileSync('.verification/analytics-release/statistics-fix-browser.json', JSON.stringify(result, null, 2));
}
console.log(JSON.stringify(result));
