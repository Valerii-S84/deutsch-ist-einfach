# Ручна перевірка статистики

Чинні критерії: [відновлення контролю](admin-restoration.md#критерії-повного-приймання). Визначення: [контракти метрик](statistics-contract.md).

Виконувати тільки на ізольованому backend із синтетичними даними. Спочатку зафіксувати commit backend, seed, now, UTC/Berlin і очікування для кожного рядка контракту. Порівняти API з очікуваннями, потім UI/API, а для дій — persisted result та audit. Окремо перевірити всі періоди, пошук, сортування, пагінацію, статуси, права, 2FA, збої, пропуски, дублікати, старий snapshot і експорти.

Не використовувати cookies або дані production. Production deploy/міграції/Caddy/DNS — лише окремий явний дозвіл. Локальні агреговані fixtures не є доказом правильності актуального SQL.

## Крок 7: порядок перемикання та повернення (локальне приймання 2026-09-13)

Production не змінювався. Цей порядок є підготовкою кроку 8, а не дозволом на deploy.
Поточне джерело збірки: Git HEAD f3c10fe плюс локальні незакомічені зміни кроків 6–7.
Analytics image: sha256:eacf2872f45458d4cceaa8b0d5c3a4a079368d37353a02d27b0d63ac422153c2.
Точний Next BUILD_ID і результати сценаріїв наведено в підсумку нижче.

### Локальний стенд і команди

Використано лише `services/analytics/compose.acceptance.yml` та
`.verification/compose.test.yml`, без root Compose або production env.
PostgreSQL 16.15, Node 22.19.0, Windows 10.0.26200 / Docker Desktop,
AMD Ryzen 5 2600X, 12 logical CPUs, 32 GiB RAM. Сайт зібраний у
`.verification/website-analytics/v1/site`, повні перевірки — у сусідній `checks`.
Скопійовано whitelist sources; `.env*` не копіюються; child environment містить
лише системний whitelist і явно синтетичні налаштування.

Виконані `npm test`, `npm run lint`, `npm run typecheck`, `npm run analytics:build`
через `node scripts/prepare-analytics-acceptance.mjs verify --v1`.
Збірка сайту: `node scripts/prepare-analytics-acceptance.mjs build --v1`
(чинний Next build з package.json). Analytics Dockerfile також збирає сервіс.
Кореневий `npm run ci` тепер включає `npm run analytics:build`; CI workflow викликає цей script.
SQL/browser команди не підмінено mocks: `verify-analytics-postgres.mjs --production`,
`verify-analytics-browser.mjs`, `verify-analytics-actions.mjs`,
`verify-analytics-reports.mjs`, `verify-admin-browser.mjs --production --v1`,
`verify-analytics-v1-browser.mjs`, `verify-analytics-operations.mjs`.

8 opt-in SQL-тестів кроку 6 у звичайному npm test пропущені явно; це не проходження
SQL lane. Реальні PostgreSQL-сценарії кроку 7 виконувалися окремими scripts.
Місце доказів — `.verification/website-analytics/v1/` та результати чинних scripts
у `step-3-browser`, `step-4-browser`, `step-5`, `postgres-results.json`.

### Перед дозволеним запуском

1. Закрити всі невдалі/невиконані перевірки підсумку. Зафіксувати commit, незмінні
   digests нового й попереднього образів та актуальні production targets. Зберегти
   доступ власника, старі джерела й перевірену резервну копію. Production стан
   попереднього образу та його резервні копії в цій задачі не перевірялися.
2. Перевірити окрему Analytics DB/user/volume без зовнішніх портів. Запустити БД,
   застосувати лише `services/analytics/db/migrations`, запустити той самий analytics
   service; перевірити авторизований health та недоступність без ключа. Сайт і його
   Contact DB не мігрувати цими командами.
3. Підготувати образ сайту з `NEXT_PUBLIC_WEBSITE_ANALYTICS_MODE=new` саме під час
   build. Це не runtime-перемикач. Передати серверу private analytics URL/key;
   не передавати ключ браузеру. Один provider пише лише в одне джерело.
4. Після окремо дозволеного deploy пройти site login → picker → шість Website
   звітів → відповідні Sessions/timeline; перевірити стару статистику, заявки,
   legacy-архів, окремий Quiz Arena login/2FA і чинні дозволені дії. Переконатися,
   що невідоме/недоступне джерело не показує виміряні нулі.
5. Виконати окремо погоджені синтетичні smoke-дії та перевірити відсутність збору
   до consent, після deny/revoke; збереження safe UTM і відсутність приватних полів.
   Початок збору не оголошувати повнотою доставки. Крок 8 передбачає 48 годин нагляду.
6. Налаштувати щоденний retention 90 днів і backups із циклом 14 днів лише в межах
   дозволеного production етапу. Тут production cron/backups не встановлювалися.

### Видалення та відновлення

Операційний запис видалення містить product_id, visitor_id та час запиту; доступ
лише оператору/сервісному обліковому запису. Запис робиться до виконання видалення
і зберігається щонайменше до спливу всіх backups, які можуть містити ці рядки.
Виконання CLI `delete-visitor deutschmit <UUID>` і повторне читання підтверджують
відсутність історії. Помилку видалення не записувати як завершений результат.

Відновлювати backup у карантинне сховище, недоступне Admin/API. До відкриття даних
повторно застосувати retention та всі видалення після моменту backup; перевірити
кількість рядків і відсутність видалених visitor IDs. Лише після цього дозволити
сервісу читати відновлене сховище. У локальному контролі було 3 backup-рядки;
відновлено 3 у недоступній сервісу схемі, повторно прибрано 1 прострочений і 1
видалений visitor, залишився 1 дозволений рядок. Public schema не змінена.
Тестовий журнал у `v1/ops-private` має вимкнене успадкування ACL і доступ лише
обліковим записам поточного sandbox та дозволеного локального Docker runner.
Це операційний журнал, без нового privacy job або таблиці.

### Повернення

При проблемі зі збором спочатку припинити його образом із build-time режимом `off`
або повернути зафіксований попередній працездатний образ. Зміна лише runtime env
не змінює NEXT_PUBLIC mode. Локальні production-образи off/new/legacy перевірено;
ідентифікатори та межі перевірки наведені в доповненні нижче. Production rollback
image/digest потрібно зафіксувати перед фактичним перемиканням.
Зберегти Analytics volume та історію для діагностики; не видаляти таблиці/контейнери
контактів або Quiz Arena і не вливати нові events у legacy таблицю. Після повернення
повторно перевірити власний login, picker, заявки/архів, стару статистику й бот-адмінку.
Не відновлювати backup у доступне сховище до replay retention/видалень.

### Підсумок кроку 7 — локальне приймання виконано (2026-09-13)

Next BUILD_ID: `K5AWB55fVRg7wXnKk9yVo`; вихідна ревізія `f3c10fe` із локальними
змінами кроків 6–7, без commit/deploy. Фінальний Analytics image:
`sha256:eacf2872f45458d4cceaa8b0d5c3a4a079368d37353a02d27b0d63ac422153c2`.
Усі обов'язкові локальні сценарії мають успішний результат. Production env,
реальні заявки та production-дані не використовувалися. Порядок запуску й
повернення наведено вище; production targets і rollback image перевіряються
перед фактичним перемиканням. Саме перемикання цим проходом не виконувалося.

| Обов'язковий сценарій | Фактичний результат |
|---|---|
| Ізольована збірка сайту | PASS: production Next build, усі шість Website routes/API |
| npm test, lint, typecheck | PASS: 518 tests / 65 files; 8 opt-in SQL tests явно SKIP у повному запуску. Після змін сервісу SQL виконано окремо; lint/typecheck пройшли після відповідних змін, фінальний test script також пройшов lint |
| SQL / service build / Docker build | PASS: фінальні 9/9 реальних PostgreSQL tests, analytics:build і Docker build |
| Контроль розділу 6 | PASS: 2 visitors / 3 sessions / 4 views / 1 Telegram click / 1 server conversion; SQL = service = Next API = browser для 7/30/90 днів; MAX active 60000 ms, 1 Quiz completion і 1 article_read |
| Consent / між вкладками | PASS: pending/deny/grant/revoke/regrant, нові й cloned tabs, окремі sessions; реальні browser та SQL rows |
| Storage / lifecycle / доставка | PASS: storage denied, offline/retry/duplicate, SPA/reload/back/forward; 12 lifecycle груп |
| BFCache | PASS: реальний persisted pageshow, не reload |
| Timeout / порядок / UTC | PASS: session rotation; reversed delivery/clock skew → sequence 1/2/3, active 30000 ms без додавання 30 хвилин; UTC-межі, повна історія сесії, missing start/gaps; timeline усіх 1101 events |
| Захист API / product/source | PASS: owner auth, підміна product/source/server success відхиляється, відповідні 401/400/403/404; нові pages/APIs закриті без сесії |
| UTM без registry | PASS: нова Unicode campaign збережена й показана у Traffic; персональний source → unknown, medium та решта події збережені |
| PII у контрольних payload/rows/logs | PASS: маркери query/hash, персональних UTM, error/stack і form text не проходять; supplemental campaign/PII та actions readbacks. Межа доказу — синтетичні контрольні дані |
| Форми / analytics conversions | PASS: обидві форми, validation/network retry, honeypot, окремі instances; persisted request і server success; Contact DB scoped rejection → form_error без server success |
| Quiz / errors / article_read / revoke | PASS: 12 actions груп; усі 15 типів подій зіставлено з реальними SQL rows |
| Окремі Analytics service / Analytics DB / Quiz Arena відмови | PASS: усі 3 outage групи; під кожною обидві форми прийняті через browser request context і по 2 заявки повторно прочитано з PostgreSQL; login, сайт, picker та решта продуктів доступні. UI partner form під service outage також перевірено actions lane |
| Quiz Arena регресія | PASS: 297 SQL-звірок empty/seeded за 7/30/90 днів; 25 browser перевірок login/2FA, користувачів і промокодів із persisted readbacks, desktop/mobile; без browser JS exceptions |
| Шість звітів / filters / session drilldowns | PASS: фінальні 9 browser reports груп після останньої SQL зміни; контрольні числа, чотири нові таблиці, точні selection і days у Sessions, приховування попередньої вибірки, desktop/mobile |
| Збережені адміністративні функції | PASS: picker, чотири продукти, стара статистика, заявки й архів залишаються поряд із шістьма Website звітами; дані продуктів не змішані |
| Retention / visitor deletion | PASS: реальна ізольована PostgreSQL, 90 днів, idempotence і незмінність site/legacy |
| Backup/restore / журнал видалень | PASS: 3 → restore 3 у карантині → retention/delete → 1; public schema незмінена; захищений журнал для двох уповноважених локальних runner accounts; replay до відкриття даних |
| 100000 подій, Overview за 90 днів | PASS: 760.3 / 798.7 / 755.9 ms, максимум <1000 ms |
| 100000 подій, Sessions за 90 днів | PASS: 177.3 / 154.7 / 142.3 ms, максимум <1000 ms |

Стенд швидкодії: Windows 10.0.26200, Node 22.19.0, PostgreSQL 16.15 Alpine,
Ryzen 5 2600X / 12 logical CPU, RAM 32 GiB; 100000 events / 10000 sessions,
90 днів, один warmup і три послідовні виміри. Початковий Overview перевищував
3 s statement timeout, Sessions мав максимум 1046.3 ms. Переглянуто SQL і три
чинні індекси. Overview тепер один раз групує події за UTC-днем; активний час
один раз підсумовується з MAX на view. Sessions рахує candidate total до LIMIT,
сортує IDs за MIN occurred_at повної історії, деталізує 50 вибраних IDs.
Окремий SQL-контроль із 51 сесією перевірив початки поза 90 днями, протилежний
порядок останніх подій, другу й порожню третю сторінки. Формули та індекси
збережені; нових подій, workers, агрегатних таблиць чи продуктів немає.

Виправлення тестового середовища: NODE_ENV=test для npm test; PYTHONPATH для
Quiz seed; ACL журналу для двох runner accounts; 30 s timeout лише bulk seed,
3 s для звітів. HTTPS proxy обробляє обрив розпочатої upstream відповіді та
слухає IPv4/IPv6 loopback. Site DB підключається і перевіряється до outage;
між відмовами тест чекає готовності Analytics. Початкові невдачі збережені
в локальних журналах і не видаються за проходження.

Останню розбіжність 0/1 conversion спричинила часова межа контрольного прикладу:
committed server event уже присутній у SQL, але його occurred_at ще попереду
statement_timestamp PostgreSQL у Docker. Browser events у fixture мають запас
2 s, server event використовує поточний годинник Windows. Тест тепер зберігає
обидва timestamps та очікує входження незміненої події в реальне вікно звіту;
число 1, формули й timestamps записів не підмінюються. Фінальний reports lane
повністю пройшов, включно з SQL = service = API = UI.

Докази у `.verification/website-analytics/`: `step-3-browser/results.json`,
`step-4-browser/results.json` (12 PASS), `step-5/results.json` (9 PASS),
`step-5/fixture-clock.json`, `v1/quiz-browser/results.json` (25 PASS),
`v1/supplemental-initial.json` (campaign/PII PASS), `v1/supplemental-browser.json`
(3 outage PASS), `v1/outages-final.log`, `v1/reports-clock-final.log`,
`v1/sql-pagination-tests.log`, `v1/performance.json`, `v1/performance-final.log`,
`v1/checks-final.log`, `v1/lint-final.log`, `v1/typecheck-final.log`,
`v1/service-build-final.log`, `v1/analytics-image-final.log`,
`v1/operations-final.log`. Mock/unit, SQL та browser докази розділені.
Наявні backend/RBAC обмеження Quiz Arena цією задачею не виправлялися.

Фінальна різниця годинників контрольного server event: `232.280000 ms` (occurred_at мінус database_now); сирі timestamps — `step-5/fixture-clock.json`.


### Production build modes і локальне повернення

Перевірено 2026-09-13T16:03:40.529Z; вихідний HEAD e40ffa19ad1112d9514f8ce953f604c9a88990e4 плюс зміни підготовки PR.

Dockerfile приймає build argument NEXT_PUBLIC_WEBSITE_ANALYTICS_MODE=off|new|legacy,
відхиляє інші значення й типово використовує off. Compose передає цей аргумент
під час build. Workflow publish-image на push збирає off; workflow_dispatch
дозволяє явно вибрати режим. Крім чинних тегів додається sha-<short-sha>-<mode>.
Режим записаний у label de.deutschmit.analytics-mode. Runtime env не перемикає
вже зібраний browser bundle. Усі .env-файли кореня виключені з Docker context,
включно з .env.example.

Команда перевірки: `node scripts/verify-analytics-release.mjs`. Потрібні локальний
Docker і чинна acceptance-інсталяція Playwright; створюються три локальні образи.
PASS: 3/3 Docker production builds, health/login page, 18/18 перевірок закритих
Website API без сесії, consent deny/grant/revoke, правильне єдине джерело подій
new/legacy, відсутність tracking в off навіть зі збереженою згодою та з
протилежним runtime mode. Browser JS errors: 0. YAML, ESLint сценарію пройшли.

| Режим | Локальний тег | Docker image ID |
|---|---|---|
| off | `deutschmit-analytics-release:off` | `sha256:2ed346da7578158b14334df964515e741b97c0251738844e71e56561f24ebfd1` |
| new | `deutschmit-analytics-release:new` | `sha256:21d7352ee79462393856b08b530b37e4dbd2bd9d1660c5a5cdddf32ddcf40c9f` |
| legacy | `deutschmit-analytics-release:legacy` | `sha256:9171242be5d62595ce6723e8afa0f92e8976b78f250ba94476cbc88398193d36` |

Для підготовки образу повернення: `docker build --target production --build-arg
NEXT_PUBLIC_WEBSITE_ANALYTICS_MODE=off -t deutschmit-analytics-release:off .`
(один shell command без переносу). Для інших режимів змінити argument і tag.
Перед production перемиканням зберегти попередній deployed image/digest і резервні
копії, підготувати off image у цільовому registry; наведені image IDs локальні.
Спочатку service/DB і off image, потім після дозволених health/auth перевірок
встановити окремо зібраний new image та записати початок v2. При поверненні
використати зафіксований off або попередній працездатний image, зберігаючи Analytics
volume й чинні контакти, legacy та Quiz Arena.

Межі: браузерні analytics POST перехоплено й підтверджено синтетично; ця перевірка
доводить production bundle routing/consent, а не доставку в production DB.
SQL, authenticated Admin/Quiz Arena та повні сценарії заявок спираються на наведене
вище приймання кроку 7; незмінені тести повторно не запускалися. Runtime контейнери
працювали в окремій Docker bridge network із loopback-портом без production env/БД; зовнішні
браузерні запити блокувалися. Контейнери й тестова мережа прибрані сценарієм; образи
залишено для повернення. Початковий запуск зупинився до browser checks: Docker не опублікував порт
контейнера в internal network. Стенд переведено на окремий bridge з loopback-
портом; браузерну перевірку повторено один раз без перебудови образів.
Assertion legacy payload використовує чинне поле event_type.
Докази: `.verification/analytics-release/results.json` і `build-{off,new,legacy}.log`.
Merge, registry publish, deploy, міграції та production cron/backups не виконувалися.

PR сформовано одним новим комітом від origin/main із поточного перевіреного
стану. Попередня локальна історія не публікується: одна стара версія
.env.example містить DATABASE_URL із непідтвердженим значенням пароля.
Поточний і базовий .env.example перевірено за окремим дозволом власника:
credentials порожні, заповнені значення — публічні адреси/локальний hostname.
Значення не виводилися; інші .env-файли не читалися. Перед push перевірено, що
єдиний parent нового коміту — origin/main, а blob шаблону збігається з перевіреним
поточним blob. Старі локальні коміти й робочі файли збережено.
