# Перевірка коду Quiz Arena backend

Перевірено 2026-09-08 через GitHub connector, тільки читання коду й metadata CI. Repo `Valerii-S84/quiz-arena`, default branch main, зафіксований commit `a9be50f5bf2b688962be65018385d2b832e9412a`. Production image/дані не перевірялись. Цей документ уточнює історичний контракт від 2026-04-25.

## Джерела

Усі шляхи нижче належать [цьому commit](https://github.com/Valerii-S84/quiz-arena/tree/a9be50f5bf2b688962be65018385d2b832e9412a).

- Авторизація: `app/api/routes/admin/auth.py`, `auth_models.py`, `auth_responses.py`, `auth_session.py`, `deps.py`; `app/services/admin/auth_common.py`, `auth_cookies.py`; `app/main.py`.
- Overview: `overview.py`, `overview_payload.py`, `overview_payload_kpis.py`, `overview_payload_conversion.py`, `overview_series.py`, `overview_metrics.py`, `overview_activity_metrics.py`, `overview_feature_usage.py`, `overview_streak_metrics.py` у `app/api/routes/admin/`.
- Користувачі: `users.py`, `users_listing.py`, `users_profile.py`, `users_bonus.py`.
- Контент: `content/queries.py`, `content/serializers.py`.
- Економіка: `economy/models.py`, `economy/routes.py`, `economy/queries.py`, `economy/serializers.py`, `economy_ltv.py`.
- Промокоди: `promo.py`, `promo_models.py`, `promo_serialization.py`, `promo_reads.py`, `promo_writes_status.py`.
- Система й архів заявок: `system.py`, `contact_requests.py`.

## Підтверджені уточнення й виправлення frontend

| Знахідка в актуальному коді | Наслідок / локальна зміна |
|---|---|
| Auth-cookie: qa_admin_access і qa_admin_refresh; get_current_admin перевіряє чинну authority, роль і 2FA | Шлюз зберігає тільки ці дві cookies зашифрованими. Чужі cookies не пересилає. Частковий login, verify2FA, refresh і logout збережені. XSRF-cookie у прочитаному runtime немає; власний CSRF шлюзу обов’язковий |
| Backend FastAPI routes починаються з /admin, без /api у app.main | QUIZ_ARENA_ADMIN_URL для прямого backend — origin; /api додається лише якщо його реально обслуговує зовнішній proxy |
| Promo ID генерується randbelow(2**63−1)+1 | Звичайний JSON.parse міг округлити ID і спрямувати дію не туди. Шлюз зберігає великі цілі як десяткові рядки до JSON.parse; promo клієнт/типи підтримують string ID. Тести перевіряють сусідні bigint |
| Feature events називаються friend_duel_created / friend_duel_completed | Виправлено нормативний контракт; старі скорочені назви duel_created/completed були неточними |
| DAU/WAU/MAU previous закінчуються в now−selected_days, мають власну довжину 1/7/30 днів | Це не «вчора» для DAU при вибраному 30d; контракт явно уточнений |
| Active subscriptions KPI перевіряє starts_at≤at, ends_at≥at, ACTIVE/PREMIUM; попередній at=now−selected_days | Це знімки поточного status; історичний стан entitlement, зміненого після того моменту, може бути невідтворюваним |
| Revenue KPI має status PAID_UNCREDITED/CREDITED, revenue_series/top_products — тільки paid_at | Розбіжність зберігається в backend. UI пояснює різні визначення й сигналізує про розбіжність, не вигадує виправлені значення |
| Content coverage = COUNT усіх attempts / COUNT питань ×100 | Може бути >100%. Підпис змінено на «Versuche je Frage (%)». Pure контроль: 5 спроб / 2 питання =250% |
| Content lifetime; flagged limit100, exact question_text duplicates limit20; mode-level частки мають знаменники mode/all | Уточнено контракт; повторні спроби рахуються, це не distinct coverage |
| Purchases: paid_at IS NOT NULL без статусного фільтра; total/charts мають той самий filters, items приєднує User | Cards не є revenue KPI overview. API підтримує product/user_id/from/to, але старий UI їх не мав; відновлений базовий UI page1 limit50 збережений |
| Subscriptions ACTIVE фільтрує status, але не starts_at/ends_at; limit500, total=len(items) | Не те саме, що active_subscriptions KPI. Підпис і контракт уточнено |
| Cohorts: користувачі за 12 тижнів; paid statuses; distinct user_id у week offset=floor((paid_date−created_date)/7), 0..8 | Недозрілі тижні backend видає як 0; UI має застереження. Середні останніх 8 когорт незважені, не retention загальної бази |
| LTV: 30 діб після реєстрації; paid statuses; SUM Stars / COUNT DISTINCT User, EUR ×0.02; date_trunc week | Незрілі когорти не виключаються. DB timezone слід звірити на стенді; це неповне lifetime value |
| System queue_stats.failed = LLEN celery; pending=sum LLEN q_high/q_normal/q_low; за недоступного Redis повертає нулі | UI називає показник Queue celery; за services.redis.ok=false не показує ці нулі |
| Bot webhook ok=(processed_updates за 15m >0) | Відсутність трафіку не доводить аварію. UI пояснює це |
| System errors: AnalyticsEvent event_type ILIKE %error% за 24h, top10; Outbox FAILED/ERROR 24h limit200 | Це різні джерела; суми не прирівнюються |
| Latency: UserEvent api_latency за 14d; numeric latency_ms, DB-date buckets; sorted index round((N−1)×ratio) | Конкретний дискретний percentile estimator, не довільний p95; контроль pure формули виконано |
| Promo reveal для не-super_admin повертає masked record без raw_code; toggle має row lock і audit; revoke змінює активні reservations | UI не вважає відсутній raw_code нулем чи успішним розкриттям. Повне збереження й audit потребують інтеграційного сценарію |
| User profile, bonus energy/streak_token/premium_days, block/unblock/reset_state є чинними API | Додано доступ із user list у профіль та дії, reason/amount bounds, reset confirmation, повторний GET; runtime постумови ще потребують стенда |
| Архів contact_requests має int ID, новий сайт — UUID | Відновлено дві явні вибірки `/admin/deutschmit/requests`, без перенесення даних. Нові заявки читає власна БД; архів — явний контракт backend бота |

## Контрольні докази

`python scripts/verify-quiz-backend-formulas.py` виконав **21 контроль** незмінених pure-функцій із зафіксованого commit: delta, нульові знаменники, conversion, duel rate, вікна 7/30/90, дискретні p50/p95, coverage>100, mode-level частки, distinct cohort purchasers. Вхідні джерела збережені в `docs/statistics-fixtures/backend-formulas-source.json`. Скрипт через AST бере тільки явно перелічені функції, не імпортує backend, не читає env і не підключає мережу/БД. Це НЕ перевірка SQL або авторизації.

Прочитано інтеграційний `tests/integration/test_admin_overview_stats_integration.py`: seed із трьома користувачами, quiz sessions, покупкою та bot_started events; очікує start=2, first quiz conversion=50%, retention D1=100%, DAU=2, години 10/11/12=2/2/1, funnel=2/1/1/1. Це узгоджується зі збереженим 7d DTO.

Існуючий [CI run 32762656906](https://github.com/Valerii-S84/quiz-arena/actions/runs/32762656906) для того самого commit має success: `lint_unit`, `integration`, `tournament_regression`; metadata job integration підтверджує успішний крок `Pytest (integration)`. Цей CI запускався раніше, **не цим агентом**, і не містить новий frontend-шлюз. Логи й секрети не читались.

## Додаткова наскрізна перевірка 2026-09-08

На ізольованому Linux/FastAPI/PostgreSQL 16/Redis 7 стенді цього commit виконано 162 backend тести (1 штатний skip), 297 звірок контрольних даних і 12 SQL сценаріїв меж/DST/дублікатів/контенту/економіки. Next production build пройшов 25 реальних браузерних сценаріїв через HTTPS і TOTP 2FA. Зупинка тільки бота не порушила login, заявки й власну аналітику сайту. Актуальні докази: [результат приймального проходу](admin-restoration.md#результат-приймального-проходу-2026-09-08).

**Відтворений дефект backend у базовій версії:** `users_bonus.py::apply_bonus` для `premium_days` завжди вставляє новий ACTIVE PREMIUM. За наявного ACTIVE PREMIUM це порушує `uq_entitlements_active_premium_per_user`; транзакція відкочується, API дає 500, шлюз — 502. Перше надання пройшло, повторне — ні. На цьому етапі backend код не змінювався. Окремо SQL підтвердив різницю refund-фільтрів revenue KPI/series. Це дефекти підключеної адмінки бота, а не блокери автономного сайту.

## Що залишалося Partial до цього проходу

Повний локальний browser→Next→FastAPI→PostgreSQL/Redis сценарій із новим шлюзом, актуальні deployed config/tag, повторні читання persisted результатів кожної мутації та audit, DST/межі всіх SQL-вікон, ресурсні аварії на спільному VPS. Потрібен ізольований backend-стенд із синтетичними credentials і даними; production для цього не використовувати. Відомі неточності backend не приховано «правильними» нулями та не змінено remote код.

## Локальне виправлення двох дефектів

Виправлено локальну копію `quiz-arena` у `.verification/backend` на базі `a9be50f5bf2b688962be65018385d2b832e9412a`. Оскільки тестова копія виключена з Git сайту, зміни коду й регресійні тести збережено в переносному [patch](quiz-arena-backend-fixes.patch). Remote-репозиторій бота та production не змінено.

- `users_bonus.py`: наявний ACTIVE PREMIUM продовжується від `max(ends_at, now)`, безстроковий залишається безстроковим. Scope, джерело покупки й metadata зберігаються. Блокування рядка користувача серіалізує одночасні перші бонуси; чинний API, UserEvent і адміністративний audit збережені.
- `overview_series.py`: денна серія й top products використовують PAID_UNCREDITED/CREDITED у тому самому вікні `[from, to)`, що KPI. REFUNDED і невдалі покупки виключаються. Контроль refund 100: картка=0, сума серії=0, top products порожній; змішана вибірка дає 200 у всіх трьох обчисленнях для 7/30/90d.
- Змінено лише два backend-модулі та три тестові файли. Схема БД, залежності й API сайту не змінюються. Передавання `QUIZ_ARENA_ADMIN_URL` у локальному `compose.yml` уже було виправлено раніше.

Перевірка на наявному ізольованому PostgreSQL/Redis стенді: **41 цільовий тест пройдено, 1 штатний skip** (недосяжна гілка overview). Після виправлення тестового seed і відокремлення нових audit-подій від історії попереднього запуску всі 7 Premium-сценаріїв пройдено повторно. Зведення останнього результату кожного тесту: `.verification/backend-fixes-results.json`; первинні звіти — `backend-fixes-tests.xml` та `backend-premium-fixes-tests.xml` поруч.

Цільова команда всередині тестового backend-контейнера:

```sh
python -m pytest -q --tb=short tests/api/admin/test_admin_users.py tests/api/admin/test_admin_users_routes.py tests/api/admin/test_admin_overview.py tests/api/admin/test_admin_overview_routes.py tests/api/admin/test_admin_overview_payload_unit.py tests/integration/test_admin_bonus_integration.py tests/integration/test_admin_overview_stats_integration.py
```

Ruff, Black `--check`, isort `--check-only` і mypy пройдено для всіх п’яти змінених Python-файлів. Повний backend-suite не запускався: перевірки обмежено двома виправленими дефектами та пов’язаними API-регресіями.

Patch пройшов `git apply --check --no-index` на незміненій базі та зворотну перевірку на виправленій копії. Для перенесення в сумісний checkout `quiz-arena`: `git apply --check /path/to/quiz-arena-backend-fixes.patch`, потім `git apply /path/to/quiz-arena-backend-fixes.patch`.

Цей прохід перевіряє backend API/SQL і збережені постумови двох виправлень. Повторний браузерний прохід, публікація patch та перевірка реальної production-конфігурації не виконувалися. Локальний HTTPS і production-режим збірки з попереднього проходу не є перевіркою розгорнутого production.
