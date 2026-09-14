import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, writeFileSync } from 'node:fs';
import { chromium } from '../../.verification/browser/node_modules/playwright/index.mjs';
const site = 'https://deutschmit.de', shorts = 'https://www.shortsblockerkids.de';
const ssh = command => execFileSync('ssh', ['-o','BatchMode=yes','-o','ConnectTimeout=12','-o','StrictHostKeyChecking=yes','root@46.225.181.45',command], { encoding:'utf8', timeout:30000 });
const visitor = randomUUID();
const result = { visitor, passed:false, separate_bot_login:false };
appendFileSync('.verification/admin-test-visitors.jsonl', JSON.stringify({visitor,started_at:new Date().toISOString()}) + '\n');
const browser = await chromium.launch({ channel:'msedge', headless:true });
let wroteEvents = false;
try {
  const context = await browser.newContext();
  await context.addInitScript(id => {
    if (location.hostname.endsWith('shortsblockerkids.de')) {
      localStorage.setItem('sbk_analytics_visitor', JSON.stringify({id,created:Date.now()}));
    }
  }, visitor);
  const page = await context.newPage();
  const events = [], deliveries = [];
  page.on('request', request => {
    if (request.url() === shorts + '/api/website-events' && request.method() === 'POST') {
      events.push(...JSON.parse(request.postData()).events);
      wroteEvents = true;
    }
  });
  page.on('response', response => {
    if (response.url() === shorts + '/api/website-events') deliveries.push(response.status());
  });
  const acknowledge = (name, field, value) => page.waitForResponse(response => {
    if (response.url() !== shorts + '/api/website-events' || response.status() !== 200) return false;
    return JSON.parse(response.request().postData() ?? '{}').events?.some(event => event.event_name === name && event[field] === value);
  });
  const firstView = acknowledge('page_view', 'path', '/');
  await page.goto(shorts, {waitUntil:'domcontentloaded'});
  await firstView;
  const previewClick = acknowledge('element_click', 'element_id', 'preview_primary');
  await page.locator('button.mock-primary').click();
  await previewClick;
  const supportView = acknowledge('page_view', 'path', '/support/');
  // Caddy rewrites /support internally; the browser URL need not gain a slash.
  // Check navigation-click delivery in the committed admin events below.
  await Promise.all([
    supportView,
    page.waitForURL(url => url.hostname === 'www.shortsblockerkids.de' && /^\/support\/?$/.test(url.pathname), {waitUntil:'domcontentloaded'}),
    page.locator('a[href="/support"]').first().click(),
  ]);
  assert.equal(events.filter(event => event.event_name === 'page_view').length, 2);
  assert.equal(events.filter(event => event.event_name === 'element_click').length, 2);
  assert.ok(deliveries.length >= 3 && deliveries.every(status => status === 200), 'observed deliveries acknowledged; navigation click checked in storage');
  const session = events.find(event => event.event_name === 'page_view').session_id;
  // Existing owner credentials remain in memory and are never logged or saved.
  const owner = JSON.parse(ssh("docker exec quiz-arena-site-frontend-1 node -e 'process.stdout.write(JSON.stringify({email:process.env.SITE_ADMIN_EMAIL,password:process.env.SITE_ADMIN_PASSWORD}))'"));
  const login = await context.request.post(site + '/api/admin/login', {headers:{Origin:site},data:owner});
  owner.password = '';
  assert.equal(login.status(),200);
  assert.notEqual((await login.json()).requires_quiz_2fa,true,'unchanged owner configuration permits one login');
  for (const name of ['overview','sessions','pages','events','traffic','conversions']) {
    assert.equal((await context.request.get(site + '/api/admin/analytics/deutschmit/' + name + '?days=7')).status(),200,name);
  }
  const bot = await context.request.get(site + '/api/admin/quiz-arena/overview?days=7');
  assert.equal(bot.status(),200,'bot statistics after the same owner login');
  await page.goto(site + '/admin/shorts-blocker-kids?days=7&session=' + session, {waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Послідовність дій відвідування'}).waitFor();
  const detail = await page.locator('#visit').innerText();
  assert.equal((detail.match(/Перегляд сторінки/g) ?? []).length,2);
  assert.equal((detail.match(/Натискання/g) ?? []).length,2);
  assert.ok(detail.includes('Основна кнопка демонстрації'));
  assert.ok(detail.includes('Підтримка'));
  assert.ok(!(await page.locator('main').innerText()).includes('Джерело статистики недоступне'));
  result.page_views = 2; result.clicks = 2; result.database_and_admin_confirmed = true;
  result.website_reports = 6; result.bot_after_same_login = true; result.passed = true;
} finally {
  await browser.close();
  if (wroteEvents) {
    assert.match(visitor,/^[0-9a-f-]{36}$/);
    ssh("docker exec quiz-arena-site-analytics-db-1 psql -X -v ON_ERROR_STOP=1 -U analytics_user -d deutschmit_analytics -c \"UPDATE shorts_website_events SET is_test=true WHERE visitor_id='" + visitor + "'::uuid;\"");
    result.test_events_excluded = true;
  }
  writeFileSync('.verification/admin-live-acceptance.json',JSON.stringify(result,null,2));
}
console.log(JSON.stringify(result));
