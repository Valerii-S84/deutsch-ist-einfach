import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const { chromium } = await import(pathToFileURL(resolve('.verification/browser/node_modules/playwright/index.mjs')));
const base = 'https://deutschmit.de';
const testName = 'DEPLOYMENT TEST PR22';
const resumeContact = process.argv.includes('--resume-contact');
const initialOutput = resolve('.verification/analytics-release/production-browser-new.json');
const previousVisitor = resumeContact ? JSON.parse(readFileSync(initialOutput, 'utf8')).visitorId : null;
if (previousVisitor) assert.match(previousVisitor, /^[0-9a-f-]{36}$/i);
const output = resumeContact ? resolve('.verification/analytics-release/production-browser-contact.json') : initialOutput;
const events = [], responses = [], errors = [];
const evidence = { startedAt: new Date().toISOString(), status: 'running', testName };
const sshOptions = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=12', '-o', 'StrictHostKeyChecking=yes', 'root@46.225.181.45'];
function remote(script) {
  const encoded = Buffer.from(script).toString('base64');
  return execFileSync('ssh', [...sshOptions, 'printf %s ' + encoded + ' | base64 -d | bash'], { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await context.addInitScript(() => {
    document.addEventListener('click', event => {
      const link = event.target.closest?.('a');
      if (link && /^https?:/.test(link.href) && new URL(link.href).origin !== location.origin) event.preventDefault();
    }, true);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => errors.push(error.message));
  let analyticsRequests = 0, legacyRequests = 0, contactStatus;
  page.on('request', request => {
    if (request.method() !== 'POST') return;
    if (request.url().includes('/api/public/website-analytics/events')) legacyRequests++;
    if (request.url().includes('/api/public/analytics/events')) {
      analyticsRequests++;
      events.push(...(request.postDataJSON()?.events ?? []));
    }
  });
  page.on('response', response => {
    if (response.url().includes('/api/public/analytics/events')) responses.push(response.status());
    if (response.url() === base + '/api/contact' && response.request().method() === 'POST') contactStatus = response.status();
  });
  await page.goto(base + (resumeContact ? '/contact' : '/?utm_source=production-smoke&utm_medium=qa&utm_campaign=release23'), { waitUntil: 'networkidle' });
  if (!resumeContact) {
    await page.waitForTimeout(400);
    assert.equal(analyticsRequests, 0, 'no collection before consent');
    await page.getByRole('button', { name: 'Analytics ablehnen', exact: true }).click();
    await page.goto(base + '/wissen', { waitUntil: 'networkidle' });
    assert.equal(analyticsRequests, 0, 'no collection after deny');
    await page.getByRole('button', { name: 'Analytics-Einstellungen', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Analytics erlauben', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('deutschmit_analytics_session_v2'))?.sequence >= 2);
  evidence.visitorId = await page.evaluate(() => JSON.parse(localStorage.getItem('deutschmit_analytics_visitor_v2')).id);
  assert.match(evidence.visitorId, /^[0-9a-f-]{36}$/i);
  if (!resumeContact) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(350);
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.locator("header a[data-analytics-id='telegram_bot']:visible").first().click();
    await page.getByRole('button', { name: 'Heutige Runde starten', exact: true }).click();
    for (let question = 0; question < 5; question++) {
      await page.locator('button[aria-pressed="false"]:visible').first().click();
      if (question < 4) await page.getByRole('button', { name: 'Nächste Frage', exact: true }).click();
    }
    evidence.quizAnswers = 5;
    await page.goto(base + '/contact', { waitUntil: 'networkidle' });
  }
  await page.getByRole('button', { name: 'Unverbindliche Lernanfrage starten', exact: true }).click();
  // Multi-select labels include a visible checkbox prefix in their accessible name.
  const choices = [/^26-35$/, /^B1(?:\s|$)/, /Im Alltag sprechen$/, /Individuell mit Lehrkraft/, /Abend \(nach 17:00\)$/, /^2x pro Woche$/, /^50-100 EUR$/];
  for (let step = 1; step <= 3; step++) {
    const name = page.locator('#student-name');
    if (await name.isVisible()) await name.fill(testName);
    const contact = page.locator('#student-contact');
    if (await contact.isVisible()) await contact.fill('deployment-test@example.invalid');
    for (const choice of choices) {
      const button = page.getByRole('button', { name: choice }).first();
      if (await button.isVisible() && await button.getAttribute('aria-pressed') !== 'true') await button.click();
    }
    for (const textarea of await page.locator('form textarea:visible').all()) await textarea.fill('SYNTHETIC DEPLOYMENT VERIFICATION. No reply required.');
    for (const checkbox of await page.locator('form input[type="checkbox"][required]:visible').all()) await checkbox.check();
    const next = page.locator('form button:visible').filter({ hasText: /Weiter|[Ss]enden|[Aa]bsenden|[Aa]bschicken/ }).last();
    assert.ok(await next.count(), 'wizard next/submit control');
    if (step === 3) {
      const submitted = page.waitForResponse(response => response.url() === base + '/api/contact' && response.request().method() === 'POST');
      await next.click();
      contactStatus = (await submitted).status();
    } else {
      await next.click();
      await page.getByText('Schritt ' + (step + 1) + ' von 3', { exact: true }).waitFor();
    }
  }
  assert.ok(contactStatus >= 200 && contactStatus < 300, 'synthetic contact accepted');
  evidence.contactStatus = contactStatus;
  await page.getByText('Danke, ' + testName + '!', { exact: true }).waitFor();
  await page.waitForTimeout(1600);
  evidence.successMessage = (await page.locator('body').innerText()).split('\n').filter(line => /Danke|eingegangen|gesendet|erhalten/i.test(line)).slice(-3);
  assert.ok(evidence.successMessage.length, 'contact success visible');
  await page.screenshot({ path: resolve('.verification/analytics-release/production-contact-success.png'), fullPage: true });
  await page.getByRole('button', { name: 'Schließen', exact: true }).first().click();
  await page.getByRole('button', { name: 'Analytics-Einstellungen', exact: true }).click();
  await page.getByRole('button', { name: 'Einwilligung widerrufen', exact: true }).click();
  const requestsAtRevoke = analyticsRequests;
  await page.goto(base + '/privacy', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  assert.equal(analyticsRequests, requestsAtRevoke, 'no collection after revoke');
  assert.equal(legacyRequests, 0, 'new browser uses only the v2 endpoint');
  assert.ok(responses.length && responses.every(status => status >= 200 && status < 300), 'all analytics deliveries accepted');
  assert.deepEqual(errors, [], 'public browser has no JS exceptions');
  const required = resumeContact ? ['session_start', 'page_view', 'form_open', 'form_submit'] : ['session_start', 'page_view', 'scroll_depth', 'element_click', 'quiz_started', 'quiz_completed', 'form_open', 'form_submit'];
  for (const name of required) assert.ok(events.some(event => event.event_name === name), 'browser event ' + name);
  const script = [
    'set -euo pipefail',
    "docker exec -i quiz-arena-site-analytics-db-1 psql -U analytics_user -d deutschmit_analytics -At -v visitor=" + evidence.visitorId + " <<'SQL'",
    "SELECT json_object_agg(event_name,n) FROM (SELECT event_name,count(*) AS n FROM analytics_events WHERE visitor_id=:'visitor'::uuid GROUP BY event_name) e;",
    'SQL',
    "docker exec -i quiz-arena-site-site-db-1 psql -U site_user -d deutschmit_site -At -v testname='DEPLOYMENT TEST PR22' <<'SQL'",
    "SELECT json_build_object('synthetic_contacts',(SELECT count(*) FROM contact_requests WHERE name=:'testname'),'site_legacy_rows',(SELECT count(*) FROM website_analytics_events));",
    'SQL',
    'docker exec -i quiz_arena_postgres_prod sh -c \'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At\' <<\'SQL\'',
    "SELECT json_build_object('website_events',(SELECT count(*) FROM website_events),'contact_requests',(SELECT count(*) FROM contact_requests),'analytics_events',(SELECT count(*) FROM analytics_events));",
    'SQL',
    ...(previousVisitor ? [
      "docker exec -i quiz-arena-site-analytics-db-1 psql -U analytics_user -d deutschmit_analytics -At -v visitor=" + previousVisitor + " <<'SQL'",
      "SELECT json_object_agg(event_name,n) FROM (SELECT event_name,count(*) AS n FROM analytics_events WHERE visitor_id=:'visitor'::uuid GROUP BY event_name) e;",
      'SQL',
    ] : []),
  ].join('\n');
  // Read only this synthetic visitor, its marked contact, and aggregate legacy counts.
  const records = remote(script).trim().split('\n').map(line => JSON.parse(line));
  evidence.database = records;
  for (const name of [...required, 'form_success']) assert.ok(records[0][name] >= 1, 'stored event ' + name);
  assert.equal(records[1].synthetic_contacts, 1);
  assert.equal(records[1].site_legacy_rows, 0);
  assert.ok(records[2].website_events >= 234 && records[2].contact_requests >= 1 && records[2].analytics_events >= 10829);
  if (previousVisitor) {
    for (const name of ['page_view', 'scroll_depth', 'element_click', 'quiz_started', 'quiz_completed']) assert.ok(records[3][name] >= 1, 'initial scenario stored ' + name);
    evidence.initialVisitorId = previousVisitor;
  }
  evidence.browserEvents = events.reduce((counts, event) => ({ ...counts, [event.event_name]: (counts[event.event_name] ?? 0) + 1 }), {});
  evidence.consent = { before: resumeContact ? 'passed in initial scenario' : 'no collection', deny: resumeContact ? 'passed in initial scenario' : 'no collection', granted: 'v2 only', revoked: 'no collection' };
  evidence.maintenance = remote('set -eu\n/opt/quiz-arena-site/current/deploy/production/operate.sh backup\nsystemctl show deutschmit-db-backup.timer -p ActiveState -p NextElapseUSecRealtime\ndocker inspect quiz-arena-site-analytics-retention-1 --format \'retention_running={{.State.Running}} restarts={{.RestartCount}}\'');
  evidence.status = 'passed';
  console.log(JSON.stringify({ status: evidence.status, visitorId: evidence.visitorId, database: evidence.database, consent: evidence.consent, quizAnswers: 5, contactStatus }));
} catch (error) {
  evidence.status = 'failed';
  evidence.error = error.message;
  evidence.browserEvents = events.map(event => event.event_name);
  console.error(JSON.stringify({ status: 'failed', error: error.message }));
  process.exitCode = 1;
} finally {
  evidence.finishedAt = new Date().toISOString();
  writeFileSync(output, JSON.stringify(evidence, null, 2));
  await browser.close();
}
