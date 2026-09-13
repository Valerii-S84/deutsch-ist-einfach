# Контракти адміністративної статистики

Нормативний документ. Належність метрики до продукту, формула, джерело, період/часова зона, свіжість, обробка помилок і контрольний приклад є обов’язковими. Метрики не переносять між продуктами за подібністю назви.

## Website Analytics v2: контракт основи кроку 2

Джерело нових подій — тільки `analytics_events` окремої БД `deutschmit_analytics`,
продукт `deutschmit`. `lib/analytics/contract.ts` визначає рівно 15 strict-схем;
`source` задає внутрішній маршрут сервісу, `received_at` — БД. Browser не може
записати `form_success`. UNIQUE `(product_id,event_id)` лишає перший запис незмінним
при retry. Агрегатні distinct за page view/run/conversion із плану належать query-крокам
5–6; повторні фізичні кліки з новими event IDs не відкидаються.

GET `/api/admin/analytics/sessions/{uuid}` перевіряє власну сесію до виклику сервісу.
Джерело фіксоване, довільні product/query/proxy заборонені. Відповідь містить події
сесії, UTC `generated_at`,
`last_received_at` цієї сесії та `history_available_from` продукту (найстаріша наявна
подія). Це не гарантія повноти або безперервності історії. Порожня сесія — `events:[]`,
помилка сховища — 503. Крок 5 прибирає початкову межу 1000 подій і додає summary;
правила порядку та UI визначені нижче. Дані `private, no-store`.

Старі формули, джерела та endpoints нижче збережені. Browser provider кроку 3
підключає новий збір тільки в режимі `new` після окремої згоди; крок 4 додає
важливі дії та підтвердження Contact API за правилами нижче. Перевірочна БД містить тільки синтетичні локальні спостереження, без
об'єднання uniques зі старою статистикою.
Схеми, межі, очищення й команди — [README сервісу](../services/analytics/README.md);
актуальні докази — [приймання кроків 1–2](website-analytics-steps-1-2-evidence.md).

### Browser producers кроку 3

`session_start`, `page_view`, `page_leave` і Telegram `element_click` походять від
`lib/analytics/browser.ts`. Grant не відтворює попередні дії; новий grant після revoke
починає нові IDs. Visitor випадковий, із ротацією 90 днів; session — одна вкладка,
timeout 30 хвилин на наступній дії. Reload зберігає session, але створює page view;
SPA/back/forward/BFCache створюють новий view на фактичний показ. Prefetch/hash та
звичайний hidden/visible його не створюють. Query/hash/довільні URL/DOM не потрапляють
до payload; UTM й referrer повторюються з входу в сесію, внутрішній перехід їх не змінює.

Після виправлень аудиту 2026-09-09 вільний Web Lock сам по собі не дозволяє
успадкувати session новою вкладкою. Строк visitor ID 90 днів також застосовується
до legacy producer: перевіряється при наступній події, старий ID без відомої дати
створення замінюється одноразово. Це не змінює збережені legacy-події або їхні формули.

Один фізичний Telegram-клік створює новий event_id; мережевий повтор використовує
попередній. `page_leave.active_ms` — cumulative оцінка: visible + focus, idle максимум
60 секунд; hidden/blur зупиняють час. `scroll_percent` — максимальна спостережувана
частка основного контенту до нижнього краю viewport, не доказ дочитування. Крок 4
додає engagement, scroll_depth та article_read за окремими умовами нижче. Відсутній page_leave лишає
невідомий час; timeout не додає 30 хвилин до active_ms. Query-агрегати/Session UI —
крок 5. Умови відмови storage/Web Locks, доставки та режими — README сервісу.

Контролі: `lib/analytics/{identity,browser,transport}.test.ts`,
`app/(public)/analytics-provider.test.tsx`, `scripts/verify-analytics-browser.mjs`;
фактичні результати — [докази кроку 3](website-analytics-step-3-evidence.md).

### Важливі дії та Contact API: крок 4

Джерело — ті самі `analytics_events`, `product_id=deutschmit`, без нових агрегатів або
звітів. Позначені CTA, меню, статті, проєкти, Telegram, Amazon та APK використовують
реєстр `lib/analytics/elements.ts`. Поля події — стабільні element/placement IDs і
категорія destination; тексти DOM та href не копіюються. Для explicit-викликів
делегований handler пропускає click; повторний фізичний click отримує новий event ID.
Чинного YouTube-посилання на публічних сторінках немає; категорія підтримана контрактом,
але її реальний перехід не оголошується перевіреним.

| Подія | Умова producer, дедуплікація та межі |
|---|---|
| element_impression | Геометричні спостереження кожні 250 мс: ≥50% площі у viewport ≥1 с у видимій вкладці з фокусом. Hidden/blur скидає dwell. Один element + placement на page view, у тому числі після повторного показу елемента |
| scroll_depth | Максимальна частка основного контенту до нижнього краю viewport; 25/50/75/90 — кожен поріг один раз на page view. Для статті content marker виключає footer і related cards |
| engagement | Не частіше 30 с і лише за приросту cumulative active_ms. Visible + focus, idle cutoff 60 с. Heartbeat не оновлює lastActivity сесії. Для майбутніх звітів береться MAX з engagement/page_leave, не сума |
| article_read | rule_version=1, один article/page view після ≥60 с active та ≥90% scroll основного контенту. Для кожного тіла згортуваної секції потрібне відкриття та ≥90% покриття viewport-інтервалами. Сам footer чи просте відкриття невидимих секцій не достатні; reflow скидає покриття зміненого тіла |
| quiz_started/completed | Випадковий quiz_run_id тільки після згоди; зберігається у sessionStorage зі своїм visitor та ключем curated/api round. Resume/reload не дублює start/complete. Completed має тільки answered_count=5 і correct_count 0–5; окремі відповіді не передаються. Не відновлюємо run, початок якого не спостерігався після згоди |
| form_open/submit/error | Form ID student/partner, випадковий instance при відкритті; submit має новий attempt ID на кожну спробу. Validation не передає назви/значення полів; мережеві/серверні помилки передають тільки фіксований код і кореляцію спроби. Старий response після revoke/regrant не прив'язується до нового instance |
| form_success | Тільки сервер після commit справжньої заявки. Strict analytics-контекст парситься окремо від контактної схеми; невалідний/відсутній/чужий form context відкидається без відхилення справної заявки. В contact_requests контекст не записується. Server event_id та conversion_id незалежні UUID, без ID заявки й контактних даних |
| frontend_error | JS error / unhandled rejection або quiz, тільки фіксовані code/component. До 5 подій на page view, без message/stack/reason/body. Збій analytics transport не створює рекурсивну error-подію |

Перед контактним fetch браузер повторно перевіряє режим `new`, поточну згоду і visitor.
Honeypot та невдалий INSERT не створюють server success. Sender виконує одну спробу
до 500 мс після commit; збій лишає заявку успішною, журнал містить лише
`analytics_contact_delivery_failed`. Outbox відсутній: analytics-конверсії можуть
втрачатися, повний операційний список — `/admin/deutschmit/requests`. Відкликання не
скасовує вже відправлений контактний запит або commit. Агрегатні distinct та інтерфейс
конверсій/сесій залишаються крокам 5–6.

Контроль: browser → local HTTPS production build → окремі PostgreSQL, усі 15 назв;
по одному success для student/partner, honeypot/SQL-відмова → 0; analytics outage →
заявка доступна в існуючому Admin. Результати, сценарії й межі —
[докази кроку 4](website-analytics-step-4-evidence.md).

### Overview та Sessions: крок 5

Маршрути `/admin/deutschmit/overview`, `/admin/deutschmit/sessions` та
`/admin/deutschmit/sessions/[sessionId]`; `/admin/deutschmit` перенаправляє на Overview.
Явні GET handlers під `/api/admin/analytics/deutschmit/` перевіряють власну сесію
до запиту через `analytics-service-client`. Продукт фіксований, невідомі/дубльовані
параметри відхиляються. SQL: `services/analytics/src/reports.ts`, тільки raw events,
один statement snapshot на відповідь, без проміжних таблиць і worker.

Вікно 7/30/90 UTC-днів: `[00:00 UTC N−1 днів тому, generated_at)`, за `occurred_at`.
Ключі TanStack Query містять продукт, звіт та всі його фільтри; detail також містить
session ID і вибраний період позначок. Усі відповіді `private, no-store`.

| Поле | Формула / межі |
|---|---|
| visitors / sessions | DISTINCT visitor_id / session_id усіх подій у вікні; не сума денних distinct |
| page_views | DISTINCT page_view_id тільки серед page_view; семантичні повтори не збільшують KPI |
| telegram_clicks | COUNT element_click із destination=telegram; новий фізичний click рахується окремо |
| analytics_conversions | DISTINCT conversion_id серед server form_success; total контактної БД не додається |
| daily_series | Усі N UTC-днів у порядку дат, включно з порожніми днями; ті самі формули |
| top_pages | Top 20 path за views DESC/path ASC; page visitors — DISTINCT visitor_id тільки page_view цього path; кліки — на тому самому path |
| Sessions selection | IDs з хоча б одним event, що одночасно відповідає періоду/path/event_name; 50 рядків, start DESC/session ID DESC |
| Session summary | Уся збережена сесія: початок — min occurred_at; остання активність — max browser occurred_at. Server success не продовжує активність |
| first_page / last_page, entry_source | Перша/остання спостережувана сторінка за browser sequence, fallback на server-only спостереження; джерело з першого спостереження, включно з campaign без source. Пізніша навігація його не переписує |
| active_ms | SUM максимумів cumulative active_ms по page_view_id із engagement/page_leave; немає вимірів → null, справжній вимір 0 → 0 |
| status / incomplete | timed_out при last browser activity ≤ generated_at−30 хв; active інакше; без browser events — unknown. Немає session_start або є пропуски sequence → incomplete |
| outcome | conversion, інакше quiz_completed, інакше telegram_click, інакше none; деталі також показують усі три лічильники. Quiz completions — DISTINCT quiz_run_id |
| Explorer | Усі збережені події без ліміту рядків. Browser sequence зберігає порядок; запізніле надходження не переставляє подію. Server success прив'язується до submit через attempt ID і час commit; стабільний tie-breaker event_id. Позначки поза вибраним UTC-вікном не приховують події |

UI показує Website Analytics v2, найстарішу наявну подію, last received, UTC-межі та
час розрахунку. Межа історії не гарантує безперервності. За відсутності всієї історії
KPI не видаються за виміряний нуль. Порожнє вікно справного джерела показує нулі;
loading, unavailable і snapshot старше п'яти хвилин відрізняються. Застарілість
оновлюється таймером, ручне оновлення повторює SQL; помилка приховує cached counters.

`/admin/dashboard` та його API/формули збережені як «Стара статистика сайту»;
заявки й selector архіву залишаються в Website. Нові та старі числа не підсумовуються.
Контроль SQL/API/UI і точні межі приймання: [докази кроку 5](website-analytics-step-5-evidence.md).

## Статус доказів

Quiz Arena: визначення нижче відновлено з `git show 36d8b1d:docs/statistics-contract.md` (історичний аудит 2026-04-25). Backend `a9be50f` перевірено на ізольованих FastAPI/PostgreSQL/Redis: 297 звірок контрольних даних та 12 SQL сценаріїв, включно з межами вікон і DST, пройдено. Frontend у production-режимі перевірено браузером через локальний HTTPS; фактичний production не перевірено. Відтворені backend-дефекти й наступні локальні виправлення розділено в [актуальному доповненні](backend-verification.md#локальне-виправлення-двох-дефектів). Сайтова авторизація власна (`lib/server/site-admin-auth.ts`), функціональну автономність сайту від бота підтверджено зі справжньою тестовою БД.

## Спільні правила Quiz Arena overview

Джерело: GET `/admin/overview?period=7d|30d|90d` через захищений сайт-шлюз. Продукт кожного поля цього endpoint — **Quiz Arena Bot**.

- Історичне поточне вікно `[now_utc − days, now_utc)`, попереднє `[now_utc − 2×days, now_utc − days)`. Фіксовані вікна активності, поточні entitlements і lifetime-мови — явні винятки. Previous для DAU/WAU/MAU — вікно 1/7/30 днів із кінцем now−selected_days; для subscriptions — at=now−selected_days.
- `generated_at` — timestamp із часовим поясом. У UI показується Europe/Berlin; історичний кеш backend — 300 секунд. UI позначає snapshot старшим за 360 секунд як застарілий; автооновлення overview — 60 секунд. Час отримання не замінює час джерела.
- current і previous мають бути скінченними невід’ємними числами, лічильники — цілими. `delta_pct = (current−previous)/previous×100`, округлення до 2 знаків. При previous=0: 100 для current>0, інакше 0 — історична умовність, а не нескінченне зростання. Невідповідність delta робить конкретну метрику недійсною.
- Нуль приймається тільки в коректному DTO. Відсутній/невалідний показник має стан invalid/partial; мережевий або HTTP-збій має окремий стан і не показує кеш як поточні дані. Explicit порожній масив означає, що backend не надав рядків, а не гарантію нульової бізнес-активності.
- Дубльовані години, кроки funnel, дати серій, продукти й категорії відхиляються. Відсутні години/кроки не доповнюються нулями. Невідомі демографічні поля не перетворюються на empty. Серії не заповнюються синтетичними днями.
- Activity має distinct user_id на backend: реєстрація, analytics-подія АБО quiz start. Той самий user у різних днях/годинах може рахуватися повторно; суму DAU/годин не можна називати унікальними за весь період.
- Для conversion і duel completion backend повертає 0 при знаменнику≤0; retention повертає 0 за порожньої eligible бази. Це умовність контракту; джерело denominator у DTO не надано, тому неможливо відрізнити цю умовність від виміряних 0% без деталізації backend.
- Контроль: `docs/statistics-fixtures/admin-overview-*.json`, `lib/quiz-arena-verification.test.ts`, parser/normalization/sections tests. Fixtures — історичні агреговані DTO, не повторно виконаний seed backend. У них явно додані порожні demographic arrays для сумісності нового обов’язкового повідомлення про відсутність джерела.

## Картки: визначення та очікування контрольних DTO

У колонках 7/30/90 наведено очікувані current зі збережених fixtures. Спільні правила вище застосовуються до **кожного** рядка.

| Ключ | Значення / формула | Джерело й фільтр | 7d | 30d | 90d |
|---|---|---|---:|---:|---:|
| `dau` | Distinct user_id з активністю за останні 24 години | User.created_at ∪ AnalyticsEvent.user_id ∪ QuizSession.started_at; 24h, не вибраний період | 2.0 | 2.0 | 2.0 |
| `wau` | Distinct user_id за останні 7 днів | Те саме об’єднання активності; фіксовані 7d | 3.0 | 3.0 | 3.0 |
| `mau` | Distinct user_id за останні 30 днів | Те саме об’єднання активності; фіксовані 30d | 3.0 | 3.0 | 3.0 |
| `new_users` | COUNT користувачів, створених у вікні | User.created_at; вибраний період | 2.0 | 3.0 | 3.0 |
| `revenue_stars` | SUM stars_amount сплачених покупок зі статусом PAID_UNCREDITED або CREDITED | Purchase.paid_at у вікні | 100.0 | 100.0 | 100.0 |
| `revenue_eur` | revenue_stars × 0.02; історична оцінка, не бухгалтерський дохід | Похідна від revenue_stars | 2.0 | 2.0 | 2.0 |
| `active_subscriptions` | COUNT чинних PREMIUM entitlements на момент now | Поточний стан, не кількість придбаних за період | 0.0 | 0.0 | 0.0 |
| `retention_d1` | 100 × eligible users з активністю точно на Berlin cohort_day+1 / eligible users | Нові користувачі вікна; недозрілі cohort_day+1 виключаються | 100.0 | 66.67 | 66.67 |
| `retention_d7` | 100 × eligible users з активністю точно на Berlin cohort_day+7 / eligible users | Нові користувачі вікна; недозрілі cohort_day+7 виключаються | 0.0 | 0.0 | 0.0 |
| `start_users` | Те саме значення, що new_users; НЕ події /start | User.created_at; вибраний період | 2.0 | 3.0 | 3.0 |
| `conversion_start_to_quiz` | 100 × first_quiz_users / new_users; когорти можуть відрізнятися | Перший нескасований quiz start у вікні / реєстрації у вікні | 50.0 | 66.66666666666666 | 66.66666666666666 |
| `conversion_quiz_to_purchase` | 100 × distinct paid purchase users / distinct quiz-start users | Вибраний період; не доводить послідовність подій однієї когорти | 50.0 | 50.0 | 50.0 |
| `duel_created_users` | COUNT DISTINCT user_id події friend_duel_created | AnalyticsEvent у вибраному вікні | 0.0 | 0.0 | 0.0 |
| `duel_completed_users` | COUNT DISTINCT user_id події friend_duel_completed | AnalyticsEvent у вибраному вікні | 0.0 | 0.0 | 0.0 |
| `duel_completion_rate` | 100 × duel_completed_users / duel_created_users | Рівень користувачів, НЕ кількість завершених дуелей | 0.0 | 0.0 | 0.0 |
| `referral_shared_users` | COUNT DISTINCT user_id події referral_link_shared | AnalyticsEvent у вибраному вікні | 0.0 | 0.0 | 0.0 |
| `referral_referrers_started` | COUNT DISTINCT referrer_user_id створених Referral | Referral.created_at у вибраному вікні | 0.0 | 0.0 | 0.0 |
| `daily_cup_registered_users` | COUNT DISTINCT user_id події daily_cup_registered | AnalyticsEvent у вибраному вікні | 0.0 | 0.0 | 0.0 |

## Графіки, деталізації й alert-метрики overview

| Поле / похідна метрика | Формула й джерело | Час / фільтр / контроль |
|---|---|---|
| revenue_series.stars/eur; загальний дохід графіка | SUM stars за date(Purchase.paid_at), EUR ×0.02; total = сума рядків | DB date, без явної Berlin-конверсії. Локальний backend patch застосовує PAID_UNCREDITED/CREDITED і те саме вікно, що KPI; REFUNDED виключено. Базова версія a9be50f не має status-фільтра; production-версію не перевірено |
| users_series.new_users | COUNT User.created_at за Berlin-днем | Вікно overview; контроль суми = new_users KPI |
| users_series.active_users; середнє | DISTINCT activity users за Berlin-днем; середнє = сума / кількість наданих днів | Не average за всі days, якщо дні пропущені; порожня серія показує відсутність даних |
| hourly_activity_series.active_users | DISTINCT user_id для кожної Berlin-години 0..23 за весь період | 24 buckets; повтор у різних годинах допустимий. Контроль: 24 рядки, без дублікатів |
| Пікова година / топ-3 / середнє годин | max / три найбільші active_users >0 / сума по отриманих buckets ÷ їх кількість | Partial якщо немає всіх 24; жодного zero-fill |
| funnel.Start | new_users | Реєстрації у вікні |
| funnel.First Quiz | Користувачі з першим нескасованим quiz start у вікні | Контроль фіксованого порядку ключів; не та сама когорта що Start |
| funnel.Streak 3+ | Користувачі, які вперше досягли completed-quiz streak 3 дні у вікні | COMPLETED + completed_at, distinct Berlin-дні; перший hit threshold за всю історію потрапляє у вікно |
| funnel.Purchase | Користувачі з першою сплаченою покупкою у вікні | Не всі покупці за період |
| Частка між milestones | 100 × поточний / попередній крок | Якщо крок відсутній — null; не називати строгою конверсією однієї когорти |
| top_products.revenue_stars | SUM paid_at purchase stars за product_code, top 5 descending | Локальний backend patch застосовує PAID_UNCREDITED/CREDITED, як revenue_series і KPI; у a9be50f status-фільтр відсутній. Top-5 не зобов’язаний дорівнювати total |
| user_language_distribution.users, %, total | COUNT User за нормалізованим language_code; unknown для порожнього; % = users / сума категорій ×100 | Lifetime; UI не застосовує period. Дублікати категорій відхиляються |
| user_age_distribution / user_gender_distribution | Історично []: поля профілю не збирались | Відсутність джерела, не нуль людей певного віку/статі; збір нових персональних даних не додано |
| webhook_errors.count | OutboxEvent зі статусами FAILED/ERROR | Останні 24h; історичний trigger |
| conversion_drop.from/to | Поточна quiz_to_purchase нижча за 80% попередньої | Поточне/попереднє вікно |
| suspicious_activity.invalid_promo_attempts_1h | Кількість невдалих спроб promo; trigger ≥25 | Остання година |

## Інші розділи Quiz Arena: контракти всіх груп полів

Ці історичні DTO не містять `generated_at`/часової зони/меж вікна. UI показує час **отримання** в Europe/Berlin, через 6 хвилин попереджає про застарілість, а свіжість джерела прямо називає невідомою. Дані не додаються до website analytics. Невалідний DTO або error блокує показ відповідної сторінки; local schema — `lib/quiz-arena-contracts.ts`.

| Endpoint / усі показники | Визначення й локальна формула | Фільтри / помилки / контроль / невідоме |
|---|---|---|
| users: total/page/pages/items | Backend count/пагінація; відображення `(page−1)×100+1…min(total,page×100)` | search; created_at або daily_challenge_rating; 100/сторінка. Client test перевіряє escaping і параметри, backend-код: search username/first_name ILIKE, numeric exact id/telegram_id; sort rating/COMPLETED runs/created_at/id DESC, інакше created_at/id DESC. SQL-стенд ще не запущено |
| users: streak, daily_challenge_score, daily_challenge_completed_runs | Лічильники/score із backend; середнє score = округлена сума score / кількість рядків **поточної сторінки**; топ = перший рядок у ranking | Не lifetime середнє всіх користувачів. Контроль score потребує seed backend |
| users: status/language/created_at/last_seen_at | Атрибути профілю; null дата — немає даних | Не аналітичний збір нових PII; доступ лише owner/backend role |
| purchases: total, items.stars/eur/status/source/date/product | Backend список, page=1 limit=50; значення покупок без нової перекласифікації | Немає UI-фільтра period; не приписувати йому dashboard-період; source/status/null date збережені |
| purchases.charts.revenue_by_product | Backend суми Stars/EUR за продуктом; cards = сума цих рядків | paid_at NOT NULL без статусного фільтра; без from/to lifetime. API total/charts мають однакові filters; SQL-стенд ще не запущено |
| Середній чек / Premium share | SUM product EUR / purchases.total; 100 × Premium Stars / усі Stars | total/charts використовують однакові filters; за нульового знаменника UI показує «не визначено», а не виміряний середній чек/частку |
| ltv_30d_by_cohort: cohort_size, revenue_stars_30d, ltv_stars_30d, ltv_eur_30d | Backend 30-денні cohort суми й LTV; UI не перераховує | SUM paid-status Stars за [created_at,created_at+30d) / distinct users тижня; EUR ×0.02; незрілі когорти не виключаються, DB timezone треба звірити на стенді |
| subscriptions.total/items | status=ACTIVE без date-validity, limit500, total=len(items); starts_at/ends_at, nullable ends_at | Залишок днів = ceil((ends_at−now)/86400000), не календарні Berlin-дні; null означає безстроково за старим контрактом |
| cohorts.users/wN/week_offsets | Backend розмір і відсотки; показ останніх 8 тижневих рядків, доступні W0/1/2/4/8 | Середні W0/4/8 — незважене арифметичне останніх 8. Missing → немає даних, не 0. Backend повертає 0 і для незрілих тижнів; користувачі 12 останніх тижнів, distinct paid buyers за offset 0..8 |
| content.level_stats: total_questions/attempts/coverage_percent | Перші два сумуються для карток; coverage=attempts/total_questions×100, zero denominator→0, може бути >100% | Lifetime COUNT усіх QuizAttempt; повторні спроби рахуються. Контроль backend pure: 5/2=250% |
| content.mode_level_distribution: attempts/percent_in_mode/percent_of_all_attempts | Backend частки за mode/level; UI групує й сумує attempts всередині mode | Lifetime; denominators mode attempts/all joined attempts; pure контроль 3/4=75%, 3/10=30% |
| content.flagged_questions/duplicates | Список скарг і груп дубльованого question_text з count | Підсумки зі списку — охоплення відповіді; flagged limit100; duplicates exact question_text limit20, без нормалізації |
| content.grammar_pipeline: status/updated_at/payload | Стан pipeline й атрибути, час nullable | Не виводити фіктивний success при помилці; метрики payload не підміняти invented counters |
| system.services.ok/workers/processed_updates_15m | Явний bool health, workers.length, count webhook за 15m | Відсутні workers/update — немає даних, не 0; порожній services не доводить здоров’я всіх сервісів |
| system.queue_stats.pending/failed | pending=LLEN(q_high)+LLEN(q_normal)+LLEN(q_low), failed=LLEN(celery); другий ключ не є кількістю помилок | Поточний Redis; недоступний Redis backend маскує 0, тому UI ховає значення при redis.ok=false |
| system.error_log/top_10_errors | Події та кількість за типом, сума лише видимого top10 | Не загальна кількість усіх помилок; AnalyticsEvent %error% за 24h top10; Outbox FAILED/ERROR за 24h limit200 |
| system.api_latency.p50/p95/date | Backend перцентилі; останній непорожній bucket | null → немає даних; пороги UI p95 >1000/2000 ms. UserEvent api_latency 14d, DB-date bucket, sorted index round((N−1)×ratio); pure контролі пройдено |
| promo.used_total/max_total_uses/max_per_user | Backend використання й ліміти конкретного promo | Фільтри status/query; список перших 100; розкриття code окрема role-protected дія |
| promo.stats.used_total/reserved_active/status_totals/redemptions | Backend лічильники й деталізація за id | Відсутній статус у map не доводить zero; required totals і redemptions перевіряються схемою, рівність total/detail не припускається без контракту пагінації |
| promo.audit.items | Події admin/action/time/details | Права й результат кожної mutation треба перевірити на backend; frontend invalidates відповідні запити |
| promo.bulk.generated/codes/items; revoke.revoked_count | Backend результат генерації/відкликання | Без retry запису, cancel припиняє revoke; тест CSV перевіряє точний результат escaping, не backend-транзакцію |

**Код backend і 21 pure-контроль перевірено; повного seed/SQL/RBAC сценарію нового frontend ще немає.** Не оголошувати повну статистику перевіреною лише тому, що DTO має числові поля. Сценарії приймання й таблиця стану — [адміністративний контроль](admin-restoration.md).

## Власна статистика сайту deutschmit.de (збережена)

Джерело: `website_analytics_events` власного PostgreSQL, `lib/server/site-analytics-store.ts`, GET `/api/admin/website-analytics/overview?days=7|30|90`. Авторизація — власна сесія; no-store; 401 до читання БД; invalid days→400, DB failure→503. Нових продуктових метрик у цій задачі не додано.

| Показник | Формула / період / контроль |
|---|---|
| page_views / telegram_clicks | COUNT відповідного event_type у UTC календарному вікні з сьогоднішнім днем до generated_at |
| unique_visitors | COUNT DISTINCT visitor_id окремо для всього періоду, дня або сторінки; сума денних unique не дорівнює period unique |
| daily_series | UTC day, хронологічний порядок, ті самі типи подій |
| top_pages | Top 10 path за page_views DESC, path ASC; лічильники/unique у тому самому вікні |

Контрольні дані та DB-query tests — `lib/server/site-analytics-store.test.ts`, API/client tests. Порожнє сховище — нулі й порожні масиви; помилка не є порожнім сховищем. Події переглядів не мають окремого idempotency event_id: повторні event-рядки рахуються, distinct visitor_id дедуплікує лише visitors. Час генерації відповіді не гарантує відсутність затримки доставки подій. Аналітика не має містити паролі, секрети, тексти контактних форм або зайві персональні дані.

## Публічні опційні числа Quiz Arena

GET `/stats`: users = lifetime User count, quizzes = lifetime COMPLETED QuizSession із completed_at. Це метрики бота, не трафік сайту. Публічний серверний запит без cookies, timeout 2s; відсутність конфігурації/помилка/невалідний payload показує unavailable. Runtime parser відокремлений від бот-адмінки. Поточний публічний endpoint окремо на цьому етапі не перевірявся; збережено попередній контракт.

## Відновлені адміністративні дії та заявки

Профіль користувача й bonus/block/unblock/reset_state використовують чинні backend API з повторним читанням профілю. Параметри/ролі/постумови описано в [аудиті backend](backend-verification.md). Контактні заявки мають окремий маршрут `/admin/deutschmit/requests`, явне джерело site або legacy; власна БД використовує UUID, архів — числовий ID. Їх total не є трафіком сайту або кількістю користувачів бота. Читання власного списку виконується в repeatable-read транзакції; PATCH порівнює expected_status і повертає 409 при конфлікті. Тексти форм не додаються до analytics.

## Прикладні звіти Website: крок 6

Маршрути `/admin/deutschmit/pages`, `/events`, `/traffic`, `/conversions` мають явні
GET handlers `/api/admin/analytics/deutschmit/{pages,events,traffic,conversions}`.
Власна серверна сесія перевіряється до звернення до сервісу. Продукт фіксований:
`deutschmit`; джерело — тільки `analytics_events` тієї самої Analytics DB.
SQL — `services/analytics/src/application-reports.ts`, один statement snapshot на звіт.
Без нових типів подій, таблиць, міграцій, процесів продукту чи підключень.

Спільні правила розділів 4–6 плану: 7/30/90 UTC-днів за occurred_at, початок включно,
generated_at виключно; generated_at/last_received_at/history_available_from; згода,
можливі пропуски й 90-денна retention; браузерний visitor не є встановленою особою.
Snapshot старший 5 хвилин позначений; ручне оновлення виконує SQL заново.
Немає історії, порожній період, відсутній вимір, виміряний нуль і 503 розрізняються.

| Звіт | Формули й межі |
|---|---|
| Pages | DISTINCT page_view_id серед page_view у вікні; visitors за цими views/path. MAX cumulative active_ms із engagement/page_leave за кожним view, що почався у вікні; AVG лише виміряних, поруч measured_views. Ураховано доступні пізніші виміри до generated_at. Відсутній вимір — null. Scroll — MAX threshold/scroll_percent спостережень у вікні; article_reads — DISTINCT article_id/page_view_id у вікні. Рядки охоплюють спостережені path, навіть якщо page_view загубився. |
| Clicks/Events | За типом: семантична дедуплікація views, runs, conversions, element/placement/view impressions, scroll threshold/view та article/view; решта — події. Елементи групуються за ID/placement. CTR = distinct views із impression та пізнішим browser sequence click / distinct impression views, обидва у вікні й тому самому session/view. Реальні повторні clicks рахуються окремо; clicks без попереднього matching impression — окремий count. Frontend errors — count за дозволеним кодом/component ID. |
| Traffic | DISTINCT observed session IDs у вікні; entry-контекст першої збереженої події всієї сесії за browser sequence/occurred_at/event_id. Вхід може бути за межами періоду або без session_start. Referrer і всі UTM — окремі dimensions; direct без них, unknown при відхиленому полі. Successes — DISTINCT server conversion_id у групі/вікні. Частка = distinct sessions із success / sessions групи; не multi-touch attribution. |
| Conversions | Form open/submit/error — count подій за student/partner; success — DISTINCT server conversion_id. Website Quiz start/complete — DISTINCT quiz_run_id за quiz_id. Telegram/YouTube/Amazon/download — окремі counts element_click destinations, лише наміри. Співвідношення цих totals не є строгою воронкою. |

Усі частки містять чисельник/знаменник; 0 у знаменнику — «Nicht definiert».
Строга runtime-схема відповіді відхиляє невалідні дані. Відповіді — private, no-store.
Query keys містять звіт/період, а Sessions — усі фільтри та selection; placeholder data
вимкнені, під час запиту старі й раніше кешовані значення приховані. Помилка приховує числа.

Кожен рядок звітів, а у Forms/Quiz кожен лічильник, веде до Sessions зі збереженим
періодом і strict JSON selection. Дозволені тільки page/event/element/error/traffic/form/
quiz/intent; зайві поля відхиляються. SQL параметризований; selection вибирає session IDs
за відповідними подіями у вікні, summary/timeline зберігають усю доступну сесію.
Traffic selection точно зіставляє nullable entry dimensions. У Sessions показано активний
фільтр і є його скидання. Наявні довільні path/event фільтри можуть звузити вибірку.

Контроль розділу 6 та крайні випадки — `services/analytics/src/application-reports.test.ts`
на тимчасовому локальному PostgreSQL. API — `lib/server/analytics-report-route.test.ts`;
посилання, URL → Sessions і асинхронна зміна періоду/помилка —
`app/(admin)/admin/(secure)/deutschmit/application-report.test.tsx`.
Результат і межі перевірки: [крок 6](website-analytics-step-6-evidence.md).

## Локальне приймання v1: крок 7

Формули й 15 типів подій збережені. Overview групує UTC-дні один раз; Sessions
обчислює загальну кількість до пагінації, сортує IDs за початком повної історії
і деталізує 50 сесій. MAX active_ms за view та підсумок за session збережені.
Нових індексів, workers або агрегатних таблиць немає.

Фінально пройшли 9/9 реальних SQL-контролів і 9 browser reports груп:
контрольні числа SQL = service = API = UI, UTC, session drilldowns, filters/cache.
Некоректний порядок доставки зберігає browser sequence; timeout не додає часу.
На 100000 подіях Overview має максимум 798.7 ms, Sessions 177.3 ms (90 днів).
Усі три dependency outage сценарії, PII/UTM, retention/deletion/restore пройшли.
Тест фіксує розбіжність годинників Windows/PostgreSQL і чекає входження committed
server event у вікно звіту без зміни даних або формул.
Версія збірки, докази та порядок запуску/повернення —
[чинний протокол](statistics-manual-verification.md).
Локальне приймання завершено; production перемикання не виконувалося.
