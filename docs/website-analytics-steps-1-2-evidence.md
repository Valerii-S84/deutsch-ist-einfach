# Website Analytics: приймання кроків 1–2

Дата: 2026-09-08. **Статус: Done для локальних кроків 1–2.** Фінальне приймання:
зібраний Next.js у production-режимі → локальний HTTPS → Analytics Docker container →
справжня окрема PostgreSQL 16. Використано лише синтетичні credentials і дані.
Це не розгортання у production і не приймання кроків 3–8.

Прочитано `AGENTS.md`, `.agent/AGENTS.md`, застосовні core/project правила,
`docs/admin-restoration.md`, `docs/statistics-contract.md` і план. На початку єдиною
наявною зміною був untracked `docs/website-analytics-step-by-step-plan.md`; його текст
не змінено. Історичне формулювання «наступний крок 1» у плані описує стан планування;
поточні докази кроків 1–2 наведені тут.

## Крок 1: доступ до продуктів до/після

| Можливість до зміни | Стан після зміни / доказ |
|---|---|
| Site login і `/admin` → dashboard | Тепер → захищений `/admin/products`; справжній browser login перевірено |
| Website `/admin/deutschmit` → `/admin/dashboard` | Обидва маршрути й посилання збережені; власний API 7/30/90 повертає дані з окремої тестової site DB |
| `/admin/deutschmit/requests`, вибір site/legacy | Маршрут, обидва джерела, перегляд та керування збережені. Browser перевіряє перемикач архіву; site PATCH→SQL readback підтверджує DONE |
| Quiz Arena dashboard/users/content/economy/promo/system | Меню, маршрути, сторінки й адаптер збережені. Regression tests, посилання меню та вхід у продукт перевірено |
| Окремі Quiz login/2FA, roles, admin actions і старі redirect aliases | Реалізацію не змінено; чинні auth/proxy/API/action tests проходять. Повторного повного backend-аудиту не проводили за межами кроку 1 |
| Deutsch Trainer Bot і сайт Shorts Blocker Kids | Обидві картки збережені з явним «Джерело не підключено», без нульових метрик |
| Прямий захищений URL/API | Без site session або з підробкою доступ відхиляється до звернення до Analytics/Quiz backend |
| Перемикання продуктів | У secure layout є «Усі продукти» й посилання на реєстр; browser проходить усі чотири продукти й повертається |
| Невідомий product | Справжній HTTP 404 перевірено |
| Quiz backend вимкнений | Picker, Website і site login працюють; Quiz показує стан недоступності; архів як і раніше потребує backend бота |

Жодну метрику, дію або джерело Quiz Arena не перенесено й не видалено. Чинні
формули/контракти мають попередні докази в `admin-restoration.md` і
`backend-verification.md`; цей звіт не видає їх за повторний запуск у поточній задачі.

## Крок 2: реалізація й критерії

| Критерій | Реалізація / перевірений результат |
|---|---|
| Один сервіс та окрема БД | `services/analytics/`, власні package/lock/build/Dockerfile. Root Compose додає тільки `analytics`, `analytics-db`, окремий volume і внутрішні мережі |
| Одна таблиця й індекси | SQL inspection: тільки `analytics_events`, UNIQUE(product_id,event_id) і рівно три заплановані query indexes |
| Спільний контракт 15 подій | `lib/analytics/contract.ts`; strict поля/metadata, UUID, version 1, час −5min/+1min, UTM/hostname/path normalization; усі 15 типів записано в реальну БД |
| API → PostgreSQL → session | 14 browser types через публічний Next gateway, server success через окремий private route; admin session API читає з тієї самої БД |
| Підтвердження після COMMIT | Синтетичний deferred constraint trigger примусово зриває саме COMMIT: 503, обидва рядки batch відсутні після rollback |
| Дедуплікація | Повтори click/quiz_complete/form_success не змінюють count і received_at; 8 одночасних запитів нового event_id створюють рівно 1 рядок |
| Атомарна валідація | Один invalid item відхиляє весь batch на обох HTTP-межах, count не змінюється |
| Доступ | Чужий product, browser form_success, підроблені source/received_at, unknown fields, неправильний Origin, запит без service key/site session відхиляються |
| Ліміти | 20 подій/32768 bytes; media/encoding/JSON перевірки; 60 batch/60s на джерело, 61-й →429 + Retry-After; підстановка попереднього XFF не обходить ліміт |
| Читання | UTC timestamps, freshness/history fields, one SQL snapshot, deterministic order. 1000 рядків повертаються за sequence при однаковому часі; 1001 →422 без мовчазного обрізання |
| Перезапуск | Перезапуск сервісу, потім PostgreSQL: раніше підтверджені події перечитані без змін |
| Недоступність | Зупинені DB або Analytics →503 на читанні/записі, без false success. Після запуску дані читаються. Сайт/picker/старі API залишаються доступними |
| Міграції | Повторний запуск міграції двічі успішний, таблиць/індексів не додає; тільки Analytics DB |
| Очищення | CLI retention перевірено по обидва боки 90 днів. Visitor delete параметризований, повтор →0, інший visitor лишається; foreign product/SQL-like visitor/URL site DB відхиляються |
| Незмінність інших сховищ | Повні синтетичні snapshots contact_requests і website_analytics_events у другому PostgreSQL однакові до/після analytics, failures та cleanup |

Контрольний SQL-набір: **2 visitors, 3 sessions, 4 page views, 1 Telegram click,
1 server success, 1 quiz complete, 1 article_read**. Max cumulative active time
`/wissen` = **60000 ms**, а не сума 30000+60000. Нові агрегатні endpoints/UI не додано.

Production Compose перевірений парсером з `--no-interpolate --no-env-resolution`
і `--env-file NUL`: немає опублікованих analytics-портів, site не залежить від
готовності analytics; site та analytics не ділять мережу доступу до старої БД.
Фактичний production Compose не запускався.

## Запущені перевірки та артефакти

Артефакти в `.verification/website-analytics/` ігноруються Git. Відтворювані runner-и
збережені в `scripts/`, конфігурація синтетичного стенда —
`services/analytics/compose.acceptance.yml`.

| Команда / перевірка | Підсумок | Артефакт |
|---|---|---|
| `node scripts/prepare-analytics-acceptance.mjs test` (еквівалент `npm test`) | 53 файли, **413/413 PASS** | `tests.log` |
| `node scripts/prepare-analytics-acceptance.mjs lint` | PASS | `lint.log` |
| `node scripts/prepare-analytics-acceptance.mjs typecheck` | PASS | `typecheck.log` |
| `node scripts/prepare-analytics-acceptance.mjs build` | PASS: Next production build, ESLint/types, 39 generated pages | `build.log` |
| Service `tsc -p services/analytics/tsconfig.json`; Docker build з `npm ci` / `npm run build` | PASS; runtime npm ci містить лише postgres/zod | Tool output; локальний image `website-analytics-acceptance:local` |
| `node scripts/verify-product-picker.mjs --production` | **7/7 browser groups PASS**, Edge/Playwright, localhost HTTPS | `product-picker-results.json`, `product-picker-run.log`, `product-picker.png` |
| `node scripts/verify-analytics-postgres.mjs --production` | **14/14 API/PostgreSQL groups PASS** | `postgres-results.json`, `postgres-run.log`, `synthetic-counts.json` |
| Додаткове адресне SQL/HTTP читання 1000/1001 подій | PASS; тимчасовий visitor видалений параметризовано | `session-limits.json` |
| Root Compose parser / topology | PASS без підстановки env або запуску production | Tool output |

Перевірочна копія не читає `.env*`. TLS helper генерує новий localhost-сертифікат у
новому контейнері без мережі/даних; приватний ключ залишається в пам'яті процесу.
Уже наявний cached test image використано тільки як середовище cryptography, без
запуску backend і без його БД. HTTPS/API перевірки не вимикають site auth або TLS
перевірку Node: runner довіряє лише синтетичному публічному сертифікату.

## Межі й невирішені питання

- Нові producers, consent/session lifecycle, Contact API sender та звіти не реалізовувалися:
  це кроки 3–6. Реальні дії браузера поки використовують чинний legacy provider.
- Щоденний cron-шаблон для retention підготовлено в README. Команду перевірено;
  production scheduler не встановлено і фактичний щоденний запуск не перевірено.
- Початковий Next dev періодично давав transient 500 після першої компіляції
  404-сторінки (`Unexpected end of JSON input` до route handler). Відокремлення
  test-copy усунуло зайві перезапуски, але не цю dev-нестабільність. Її не оголошуємо
  виправленою. У фінальному Next production + HTTPS всі ті самі сценарії пройшли.
- Перевірка нової production інфраструктури/секретів, Caddy/DNS, ресурсів і реальних
  даних залишається поза задачею. Функціональна ізоляція не доводить стійкість до
  відмови спільного хоста. Rate limit процесний, для trusted proxy потрібна описана
  непублічна межа Next.js.
- Максимум session read — 1000 подій з явною помилкою переповнення; пагінація і
  пояснення повноти timeline потрібні під час кроку 5. Відомі обмеження даних/метрик
  Quiz Arena лишаються описаними в його чинних контрактах.

Commit/push, реальні дані, production, production-міграції та крок 3 не виконувалися.
Після перевірок Next, HTTPS helper і створений Compose project зупинені; синтетичні
volumes, публічний тестовий сертифікат та артефакти збережені для відтворення.
