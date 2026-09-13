import assert from 'node:assert/strict';
const base = 'https://deutschmit.de';
// Require the public counters to match Quiz Arena before accepting a deployment.
assert.ok(process.env.API_INTERNAL_URL, 'homepage statistics API configured');
const statsResponse = await fetch(process.env.API_INTERNAL_URL.replace(/\/+$/, '') + '/stats', { signal: AbortSignal.timeout(2000) });
assert.equal(statsResponse.status, 200, 'Quiz Arena public statistics');
const stats = await statsResponse.json();
const homeResponse = await fetch(base + '/', { signal: AbortSignal.timeout(15000) });
assert.equal(homeResponse.status, 200, 'public homepage');
const statsSection = (await homeResponse.text()).match(/<section id="stats"[\s\S]*?<\/section>/)?.[0];
assert.ok(statsSection, 'homepage statistics section');
assert.doesNotMatch(statsSection, /Datenabruf derzeit nicht verfügbar|vorübergehend nicht verfügbar/);
const cards = [...statsSection.matchAll(/<article[\s\S]*?<\/article>/g)].map(match => match[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
for (const [label, key] of [['Nutzer', 'users'], ['Gespielte Quizze', 'quizzes']]) {
  assert.ok(Number.isSafeInteger(stats[key]) && stats[key] >= 0, 'valid ' + key);
  assert.ok(cards.includes(label + ' ' + stats[key].toLocaleString('de-DE')), 'homepage matches Quiz Arena: ' + key);
}
console.log(JSON.stringify({ gate: 'homepage-quiz-arena-counters', passed: true, users: stats.users, quizzes: stats.quizzes }));
const privatePaths = [
  '/admin/products', '/admin/dashboard', '/admin/deutschmit/requests',
  ...['overview', 'sessions', 'pages', 'events', 'traffic', 'conversions'].map(
    name => '/api/admin/analytics/deutschmit/' + name + '?days=7',
  ),
  '/api/admin/website-analytics/overview?days=7',
];
for (const path of privatePaths.filter(path => path.startsWith('/api/'))) {
  const response = await fetch(base + path, { redirect: 'manual' });
  assert.equal(response.status, 401, 'anonymous ' + path);
}
const login = await fetch(base + '/api/admin/login', {
  method: 'POST', redirect: 'manual',
  headers: { Origin: base, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.SITE_ADMIN_EMAIL, password: process.env.SITE_ADMIN_PASSWORD }),
});
assert.equal(login.status, 200, 'site owner login');
const session = login.headers.getSetCookie().find(value => value.startsWith('site_admin_session='));
assert.ok(session && /HttpOnly/i.test(session) && /Secure/i.test(session), 'secure owner cookie');
const cookie = session.split(';')[0];
for (const path of privatePaths) {
  const response = await fetch(base + path, { headers: { Cookie: cookie }, redirect: 'manual' });
  const historical = path.startsWith('/api/admin/website-analytics/') && process.env.SITE_LEGACY_ANALYTICS_SOURCE === 'quiz-arena';
  assert.equal(response.status, historical ? 307 : 200, 'owner ' + path);
  if (historical) assert.equal(response.headers.get('location'), '/api/admin/quiz-arena/website-analytics/overview?days=7');
  if (path.startsWith('/api/')) assert.match(response.headers.get('cache-control') ?? '', /no-store/);
}
const quiz = await fetch(base + '/api/admin/quiz-arena/auth/session', { headers: { Cookie: cookie }, redirect: 'manual' });
assert.equal(quiz.status, 401, 'Quiz Arena requires its separate login');
for (const url of ['https://deutchquizarena.de/health', 'https://deutchquizarena.de/admin/login']) {
  const response = await fetch(url, { redirect: 'manual' });
  assert.equal(response.status, 200, url);
}
console.log(JSON.stringify({ gate: 'public-routing-owner-auth-and-reports', passed: true, authenticatedPaths: privatePaths.length, quizLogin: 'separate authentication required' }));
