# Analytics service і браузерний збір: кроки 1–4

Один TypeScript/Node.js процес приймає та читає події `deutschmit`. Спільний модуль
`lib/analytics/contract.ts` входить у збірки Next.js та сервісу. Крок 3 додає згоду,
сесії вкладок, коротку чергу й producers session_start/page_view/page_leave та
Telegram element_click. Крок 4 додає решту producers і Contact API success;
звіти й агрегатні запити залишаються крокам 5–6.
Старий endpoint і читання `website_analytics_events` збережені.

## Локальне перемикання браузера

`NEXT_PUBLIC_WEBSITE_ANALYTICS_MODE=legacy|new|off` задається під час **build** Next.js;
типово `legacy`. `new` пише тільки в новий API, `off` вимикає збір. Готовий bundle
не перемикається лише зміною runtime env. Production-конфігурацію тут не змінено.

Ізольований runner без `.env*`: `node scripts/prepare-analytics-acceptance.mjs build`
(типово `new`; опційно `--analytics-mode=legacy|new|off`), потім той самий runner `start`.
HTTPS: `node scripts/analytics-acceptance-https.mjs`; приймання:
`node scripts/verify-analytics-browser.mjs` з наявним `compose.acceptance.yml`.
Лише синтетичні дані. Поведінка, обмеження браузерів і результати —
[докази кроку 3](../../docs/website-analytics-step-3-evidence.md).

Приймання важливих дій: `node scripts/verify-analytics-actions.mjs` на тому самому
локальному HTTPS-стенді. Runner використовує синтетичні контакти й події, блокує
зовнішні переходи/завантаження, тимчасово зупиняє лише analytics і вводить SQL-відмову
лише для свого синтетичного контакту; тестове обмеження знімається у finally.
Він перевіряє всі 15 типів у SQL та захищеному API, обидві форми, книги, quiz,
дочитування з 60 реальними активними секундами й незмінність старих рядків.
Поточні результати та невирішене — [докази кроку 4](../../docs/website-analytics-step-4-evidence.md).

Контактний JSON може мати окреме необов'язкове поле `analytics`:
`consent: granted`, `schema_version: 1`, visitor/session/page-view UUIDs, path,
form/instance/attempt IDs і дозволений traffic-контекст. Воно не входить до контактного
record; некоректний context ігнорується. Один server success створюється тільки після
commit, з незалежним conversion UUID. Внутрішній server sender має timeout 500 мс,
без retry/outbox; помилка не змінює результат заявки і журналюється лише фіксованим кодом.

## Конфігурація і запуск

Сервіс отримує тільки `ANALYTICS_DATABASE_URL`, `ANALYTICS_SERVICE_KEY` (щонайменше
32 друковані ASCII-символи без пробілів), опційні `ANALYTICS_PORT` (3100), `ANALYTICS_HOST`.
DB URL мусить указувати користувача `analytics_user` і БД `deutschmit_analytics`;
fallback до `DATABASE_URL` відсутній. Сайт отримує лише `ANALYTICS_SERVICE_URL` і той самий
ключ. Базова URL сервісу — origin без credentials, query або path. Змінні не мають
префіксу `NEXT_PUBLIC_`. Пароль БД у URI має бути percent-encoded; для Compose-шаблону
використовуйте окремий випадковий URL-safe пароль `ANALYTICS_DB_PASSWORD`.

Локальна збірка з установленими кореневими dependencies:

```sh
npm run analytics:build
npm run analytics:migrate
npm --prefix services/analytics start
```

Окремий Dockerfile збирається з кореня репозиторію:

```sh
docker build -f services/analytics/Dockerfile -t deutschmit-analytics:local .
```

Root Compose додає тільки `analytics` та `analytics-db`, окремий volume і дві внутрішні
мережі. Сайт не має доступу до мережі Analytics DB, Analytics не приєднаний до мережі
старої БД. HTTP/DB порти нових сервісів не публікуються. Сайт не має `depends_on` на
аналітику. Контейнер сервісу при старті виконує міграцію, потім запускає HTTP.
Healthcheck перевіряє доступність таблиці; збій БД не дає успішного healthcheck.
Production і його міграції цим документом не дозволяються.

## API

Усі внутрішні маршрути, включно з health, вимагають `Authorization: Bearer <server key>`.
Немає CORS, довільного proxy, admin cookies чи ключа у браузері.

| Маршрут | Дія |
|---|---|
| `POST /internal/events/browser` | `{events: [...]}`; 14 типів, без `form_success` |
| `POST /internal/events/server` | Тільки `form_success`, `sequence: null` |
| `GET /internal/products/deutschmit/sessions/{uuid}` | Події однієї сесії |
| `GET /internal/products/deutschmit/overview?days=7\|30\|90` | KPI, весь денний ряд і top pages з raw events |
| `GET /internal/products/deutschmit/sessions?days=7&page=1` | 50 сесій; опційні path та event_name |
| `GET /health` | 200 `{ok:true}` тільки за справного сховища |
| Next `POST /api/public/analytics/events` | Origin + ліміт + browser-схема; задає `deutschmit` |
| Next `GET /api/admin/analytics/sessions/{uuid}` | Власна сесія перевіряється до виклику сервісу |
| Next `GET /api/admin/analytics/deutschmit/overview`, `/sessions`, `/sessions/{uuid}` | Явні захищені handlers для Overview і Session Explorer |

Публічний batch містить `events` і жодних інших полів. `product_id` у події можна
пропустити; єдине допустиме значення — `deutschmit`. Спільні обов'язкові поля:
`event_id`, `event_name`, `schema_version:1`, `visitor_id`, `session_id`, `page_view_id`,
`sequence` (ціле 1…2147483647 для browser), `occurred_at` (ISO з часовим поясом), `path`,
`metadata`. IDs — UUID; `source` та `received_at` у вхідному payload заборонено.
`received_at` задає PostgreSQL, `source` — внутрішній маршрут. Ідентифікатор події не
змінюється при повторі; конфлікт лишає перший запис незмінним.

Кожна metadata-схема дозволяє повторюваний session-контекст `entry_path`,
`referrer_host`, `utm_source/medium/campaign`. Це поля metadata, без вкладеного довільного
об'єкта. Точні поля 15 типів — у спільному контракті та плані. Додаткові межі v1:
стабільні element/placement/quiz IDs — 1–64 символи `[a-z][a-z0-9_-]*`,
`active_ms` — 0…86400000, scroll — 0…100, quiz counts — 0…1000 із answered ≥1 та
correct ≤ answered. Стаття — ID чинного реєстру. Frontend component — app/quiz/contact/unknown;
коди помилок фіксовані, невідомий frontend code стає `unknown_error`.
Умови фактичного показу, кліку, згоди, частоти heartbeat, 5 errors/view та семантична
дедуплікація належать producer/query крокам 3–6; цей API не доводить справжність дії.

Відомі публічні path зберігаються без query/hash; невідомі — `unknown`. Referrer — тільки
зовнішній hostname, без URL/IP. UTM нормалізуються однаково в shared-коді, не потребують
реєстру кампаній; небезпечне поле стає `unknown`, безпечні поля зберігаються.
Час приймається в інтервалі `[received−5min, received+1min]`. Запізнілий retry також
підпорядковується цьому вікну. Перевірка не зберігає сирих відхилених значень.

200 ingest повертає `{accepted, inserted, duplicates}` тільки після завершення COMMIT.
Невалідний batch — 400 цілком; >20 подій — 400; >32768 фактичних bytes — 413;
невідповідний media type/encoding — 415; читання тіла >5s — 408; без доступу — 401;
чужий Origin — 403; перевищення rate limit — 429 з `Retry-After`; збій БД/сервісу — 503.
Внутрішні невідомі маршрути — 404. SQL statement timeout 3s, lock timeout 2s,
connect timeout 2s; Next service request timeout 4s для browser/query, 500 мс для server
success. Автоматичного retry у шлюзі немає.

Читання сесії — один SQL snapshot, browser sequence та прив'язка server success до
submit через attempt ID/час commit, стабільний event_id; часові поля UTC,
плюс `generated_at`, `last_received_at` сесії і `history_available_from`
(найстаріша збережена подія продукту; null за порожнього сховища). Порожня сесія — 200
з `events:[]`, `summary:null`. Крок 5 повертає всю збережену сесію без ліміту рядків,
summary і read-time timeout 30 хв без worker. Overview та список Sessions мають
періоди 7/30/90 UTC-днів; фільтри списку вибирають IDs, summary охоплює всю сесію.
Дані повертаються `private, no-store`. Формули та приймання:
[контракт](../../docs/statistics-contract.md#overview-та-sessions-крок-5),
[докази кроку 5](../../docs/website-analytics-step-5-evidence.md).

Rate limit — 60 batch-запитів на 60s від першого запиту джерела в одному процесі.
`ANALYTICS_TRUST_PROXY=1` дозволено лише за непублічного Next.js і довіреного останнього
proxy (чинний Compose має єдиний опублікований Caddy). Використовується остання адреса
`X-Forwarded-For`; перед нею клієнт не може підставити інше джерело. Без цього режиму
запити ділять один обмежений bucket. IP ніколи не записується в БД/логи; map містить
тимчасовий HMAC із випадковим процесним ключем, TTL 60s, максимум 10000 джерел.
Для кількох процесів це не глобальний ліміт — Redis у v1 не додається.

## Міграція і очищення

Є одна ідемпотентна міграція `db/migrations/0001_create_analytics_events.sql`, одна
таблиця, UNIQUE та три заплановані індекси. Команда бере транзакційний advisory lock.
Нову міграцію треба робити ідемпотентною: таблиці migration jobs у v1 немає.

```sh
npm run analytics:cleanup
npm run analytics:delete-visitor -- deutschmit 11111111-1111-4111-8111-111111111111
# Еквівалент усередині налаштованого контейнера:
docker compose exec -T analytics npm run cleanup
docker compose exec -T analytics npm run delete-visitor -- deutschmit 11111111-1111-4111-8111-111111111111
```

Retention видаляє тільки `deutschmit` із `occurred_at < now−90 days`. Visitor-команда
перевіряє product/UUID та використовує параметризований SQL; повертає лише count.
Немає worker, черги, читання контактів або Quiz Arena. Для щоденного запуску штатним
cron підставте абсолютний шлях погодженого розгортання у такий запис (UTC):

```cron
CRON_TZ=UTC
17 3 * * * cd /ABSOLUTE/PATH/TO/deutschmit && docker compose exec -T analytics npm run cleanup
```

Планувальник production не встановлювався. В інтеграційному тесті виконується сама
команда очищення на синтетичних даних по обидва боки межі 90 днів.

## Відтворення локального приймання

`compose.acceptance.yml` — окремий Compose project, нові синтетичні БД/користувачі/volumes,
жодного читання `.env`. Test-only gateway публікує лише `127.0.0.1:45440/45442/45443`,
бо Docker Desktop не публікує порти контейнерів, підключених лише до internal-мережі.
Він не входить до продуктового Compose і має лише фіксовані TCP-напрямки.

```powershell
docker --config .docker-test-config build -f services/analytics/Dockerfile -t website-analytics-acceptance:local .
docker --config .docker-test-config compose --env-file NUL -f services/analytics/compose.acceptance.yml up -d --wait
node scripts/prepare-analytics-acceptance.mjs dev
# В іншому терміналі; потребує доступу до локального Docker:
node scripts/verify-analytics-postgres.mjs
node scripts/verify-product-picker.mjs
node scripts/prepare-analytics-acceptance.mjs test
node scripts/prepare-analytics-acceptance.mjs lint
node scripts/prepare-analytics-acceptance.mjs typecheck
# Зупиніть dev перед build у тій самій ізольованій копії:
node scripts/prepare-analytics-acceptance.mjs build
```

Для остаточного приймання використано зібраний Next у production-режимі через локальний
HTTPS. Після build запустіть `node scripts/prepare-analytics-acceptance.mjs start`
та `node scripts/analytics-acceptance-https.mjs`. HTTPS helper використовує бібліотеку
cryptography з уже наявного image `admin-acceptance-test-backend:latest` у новому
контейнері без мережі, mounts і доступу до backend. Приватний ключ генерується в пам'яті;
на диск записується лише публічний `localhost.crt`. Для Node runner задайте
`NODE_EXTRA_CA_CERTS` абсолютним шляхом до `.verification/website-analytics/localhost.crt`,
потім виконайте `node scripts/verify-analytics-postgres.mjs --production` і
`node scripts/verify-product-picker.mjs --production`. Ключі інших стендів не читаються.
Тести/lint/typecheck використовують окрему копію `checks`, щоб не перезапускати активний
Next. Після першої lazy-компіляції 404 у dev відтворювався тимчасовий Next 500; фінальне
приймання виконано без цієї нестабільності в production-режимі.

Browser smoke використовує вже встановлений `.verification/browser` Playwright і Edge.
Підготовка копіює тільки визначені sources/fixtures, створює окреме середовище із
синтетичними значеннями, без dotenv. Результати та screenshot —
`.verification/website-analytics/`; актуальний висновок — у `docs/website-analytics-steps-1-2-evidence.md`.
