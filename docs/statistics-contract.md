# Контракти адміністративної статистики

## Shorts Blocker Kids: перегляди та дії на сайті

Джерело — окрема таблиця `shorts_website_events` у сервісі аналітики, без
об'єднання з deutschmit або ботом. Producer `deploy/production/shorts-browser.js`
додається до наявного assets/site.js; HTML і CSS публічних сторінок не змінюються.
Внутрішній маршрут захищений ключем сервісу, звіт доступний через чинну сесію
адміністратора. Публічний приймач приймає тільки strict-схему та дозволений Origin.

Відвідувач = distinct visitor_id (випадкова позначка браузера, ротація 90 днів).
Відвідування = distinct session_id, поновлення після 30 хвилин перерви.
Перегляди = page_view; UNIQUE page_view_id захищає від повторної доставки.
Натискання = element_click зі сталого переліку дій; кожен фізичний клік має новий
event_id. Повтор запиту з тим самим event_id не додає подію. Кнопки демонстрації
не означають покупку або встановлення. page_leave.active_ms — накопичений час
visible + focus з idle cutoff 60 секунд; повторні значення не підсумовуються.

Періоди — останні 7/30/90 × 24 години від generated_at за UTC; відображення часу
Europe/Berlin. Звіт читається в одній repeatable-read транзакції. is_test виключений
з усіх показників. Відвідування мають пагінацію по 50; подробиці показують до 1000
подій із явним повідомленням про обмеження. Джерела — перші 100 за кількістю
відвідувань. Непідключене/помилкове джерело не показує нульові лічильники.
generated_at означає свіжість запиту; last_received_at — останню отриману подію.
history_available_from не гарантує безперервності історії. Дані до встановлення
producer відсутні. Зберігання — 90 днів; тестові події очищаються після доби.

IP, тексти форм, URL query/hash не зберігаються. Джерело переходу — лише hostname.
DNT/GPC вимикають producer; блокувальники й помилки мережі можуть спричинити втрати.
Контроль: 2 покази сторінок + 2 фізичні кліки одного браузера/відвідування;
перевірка PostgreSQL підтверджує дедуплікацію, ізоляцію та виключення тестових подій.
Команди: `node scripts/verify-shorts-browser.mjs`, `check-shorts-events.mjs`
у disposable DB та `check-admin-statistics-browser.mjs` після розгортання.

Нормативний документ. Належність метрики до продукту, формула, джерело, період/часова зона, свіжість, обробка помилок і контрольний приклад є обов’язковими. Метрики не переносять між продуктами за подібністю назви.

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

## Публічні опційні числа Quiz Arena

GET `/stats`: users = lifetime User count, quizzes = lifetime COMPLETED QuizSession із completed_at. Це метрики бота, не трафік сайту. Публічний серверний запит без cookies, timeout 2s; відсутність конфігурації/помилка/невалідний payload показує unavailable. Runtime parser відокремлений від бот-адмінки. Поточний публічний endpoint окремо на цьому етапі не перевірявся; збережено попередній контракт.

## Відновлені адміністративні дії та заявки

Профіль користувача й bonus/block/unblock/reset_state використовують чинні backend API з повторним читанням профілю. Параметри/ролі/постумови описано в [аудиті backend](backend-verification.md). Контактні заявки мають окремий маршрут `/admin/deutschmit/requests`, явне джерело site або legacy; власна БД використовує UUID, архів — числовий ID. Їх total не є трафіком сайту або кількістю користувачів бота. Читання власного списку виконується в repeatable-read транзакції; PATCH порівнює expected_status і повертає 409 при конфлікті. Тексти форм не додаються до analytics.
