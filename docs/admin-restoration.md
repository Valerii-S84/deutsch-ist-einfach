# Відновлення адміністративного контролю — 2026-09-08

Статус: **локальні перевірки автономного сайту пройдено; production-конфігурацію не перевірено**. Два відтворені дефекти належать backend `quiz-arena`: повторний Premium-бонус і різні refund-фільтри доходу. Вони самі по собі не блокують деплой автономного сайту. Локальні backend-виправлення та їх перевірка описані в [актуальному доповненні](backend-verification.md#локальне-виправлення-двох-дефектів). Таблиці початкового відновлення й попереднього приймального проходу нижче є історичними доказами.

## Межі й докази початкового стану

- Початковий `git status --short` порожній; HEAD `9c1bdb8` (`Rename project to deutsch-ist-einfach`).
- `git show --stat b08e413`: видалено 31/змінено файлів, 5212 видалених рядків, 179 доданих. Основна втрата UI — цей коміт.
- Порівняння `git diff --name-status 36d8b1d HEAD -- app lib docs` виявило додаткову втрату контактних заявок, API-клієнта, контрактів, тестів і чотирьох контрольних DTO.
- `36d8b1d` існує в локальній історії. Поточний production image tag **не встановлено**: локальний Git не доводить стан розгорнутого контейнера. Деплой, SSH, production-API та реальні дані не використовувалися.
- Backend знайдено через GitHub connector: `Valerii-S84/quiz-arena`, main `a9be50f`. Прочитано правила, auth, overview, users, economy, content, promo, system, contact requests. [Окремий аудит](backend-verification.md) містить джерела, 21 виконаний pure-контроль і metadata успішного CI цього commit.

## Повний перелік втрат у доступному Git-порівнянні

| Функція / втрачені деталі | Джерело до видалення | Відновлення / перевірка | Результат | Невирішене питання |
|---|---|---|---|---|
| Dashboard: DAU, WAU, MAU, нові користувачі, Stars/EUR, активні Premium, D1/D7, start_users, дві конверсії; current/previous/delta | `/admin/overview`; dashboard-config/types | Окрема сторінка `/admin/quiz-arena/dashboard`, DTO та перевірка арифметики | Partial | Актуальні SQL, кеш і контрольна БД |
| Періоди 7d/30d/90d, час генерації Berlin, попереднє вікно | Той самий endpoint | Передавання періоду, перевірка відповідності відповіді; дата, застарілість | Локально перевірено | Зміщення previous для фіксованих DAU/WAU/MAU треба підтвердити |
| Графіки доходу Stars/EUR, денних нових/активних користувачів, 24 годин; пік, топ-3 години, середнє | revenue/users/hourly series | Відновлені Recharts, нормалізація, контроль дубльованих bucket | Partial | Узгодити часові зони й фільтри доходу backend |
| Milestones Start/First Quiz/Streak 3+/Purchase, співвідношення сусідніх кроків | funnel | Порядок за ключем, пропуски/дублікат не стають нулем | Локально перевірено | Це різні когорти, не строгий funnel |
| Топ-5 продуктів, мови, вік, стать | top_products / distributions | Відновлено, відсутнє поле — помилка секції | Partial | Вік/стать історично не збираються; додавати збір не дозволено |
| Дуелі: створення/завершення/частка; referral share/referrers; Daily Cup | feature_usage | Відновлені всі 6 метрик і delta | Partial | Події та distinct на backend |
| Webhook errors, conversion drop, suspicious promo alerts | alerts | Відновлені alert-картки | Partial | Порогові правила й вікна backend |
| Користувачі: список, total, 100/сторінка, пошук id/telegram id/username/ім’я, дві сортування, переходи сторінок | `/admin/users` | `/admin/quiz-arena/users`; фільтри без показу кешу іншої вибірки | Partial | Реальні пошук, порядок tie-break, total/pages |
| Профіль у рядку: статус, мова, дати, streak, daily score/completed runs; топ користувач/середнє поточної сторінки | users DTO | Поля й локальні обчислення збережені; помилку не маскує 0 | Partial | Формула рейтингу; серверні права |
| Контент: питання/спроби/coverage за рівнем, mode-level %, flagged questions, grammar pipeline, дублікати, підсумки | `/admin/content` | `/admin/quiz-arena/content`, перевірка DTO, явний збій | Partial | SQL і семантика payload; старий UI був моніторингом, CRUD питань у цій версії не було |
| Економіка: перші 50 покупок, total, статус/джерело/дати/Stars/EUR; дохід за продуктом, середній чек, Premium share | `/admin/economy/purchases` | `/admin/quiz-arena/economy`, старі таблиці/графіки | Partial | Старий UI запитував лише page=1; це обмеження збережене, не названа повна історія |
| Активні підписки, дати, час до закінчення; LTV 30d, останні 8 когорт і W0/1/2/4/8, середні W0/4/8 | subscriptions/cohorts | Відновлено; пропущена когорта/тиждень не стає нулем | Partial | Предметна формула/дозрівання когорти, охоплення charts і total |
| Промокоди: пошук, active/inactive/expired/all, перші 100, продуктова довідка, перевірка доступності коду | `/admin/promo`, products/check-code | `/admin/quiz-arena/promo`, DTO і форми | Partial | Серверна фільтрація/унікальність/ліміти |
| Створення, bulk generate, редагування, toggle, revoke з причиною | POST/PATCH promo routes | Відновлено, мутації не повторюються автоматично, cancel revoke припиняє дію | Partial | Постумови на ізольованому backend, конкурентні запити |
| Деталі: параметри, stats, audit, redemptions/status totals/active reservations; super_admin reveal | promo/{id}, stats/audit, auth/session | Відновлено; reveal через захищений POST шлюзу; роль backend збережена | Partial | Реальний RBAC/2FA та audit; шлюз не надає super_admin самостійно |
| Одноразове отримання коду, copy, CSV single/bulk | promo-code-export | Відновлено, CSV escaping і захист від формул | Локально перевірено | Потрібен браузерний сценарій clipboard/download |
| Система: API/PostgreSQL/Redis/Celery/webhook, workers, updates15m, pending/failed, логи, топ-10, p50/p95 | `/admin/system` | `/admin/quiz-arena/system`, DTO, null/помилка не перетворюється на «стабільно» | Partial | Джерела health/latency й свіжість |
| Login, 2FA, сесія адміністратора бота | `/admin/auth/*`, старий login | Окремий вхід після власного входу сайту, зашифровані cookies backend | Partial | Актуальні cookie/CSRF/trusted-origin/ролі backend |
| Старі URL /admin/users/content/economy/promo/system | secure layout | Redirect у нові бот-розділи, меню окремих продуктів | Локально реалізовано | Browser navigation smoke |
| Контактні заявки: список, total, повідомлення/деталі, NEW/IN_PROGRESS/DONE/SPAM | dashboard-contact-requests-section у `36d8b1d`, `/admin/contact-requests` | Відновлено `/admin/deutschmit/requests`: власна БД з UUID + явно окремий backend-архів із int ID; статуси й пагінація | Partial | Немає міграції/змішування даних; потрібен наскрізний тест двох сховищ |
| Контракти, контрольні JSON, тести нормалізації, API-boundary | lib/statistics-payload, docs | Повернуто бот-DTO в окремі lib/quiz-arena-*; публічний parser не залежить від адмінки | Локально перевірено | DTO-перевірка не доводить SQL-розрахунки |

## Карта продуктів

Вхід `/admin` та успішний site login тепер ведуть до захищеного `/admin/products`.
Картки походять із чинного реєстру, перемикання «Усі продукти» доступне у secure layout.
Маршрути продуктів у таблиці збережені. Deutsch Trainer та Shorts Blocker Kids явно
показують «Джерело не підключено». Адаптер, меню, ролі, 2FA й дії Quiz Arena не змінені.
Окрема основа Website Analytics v2 не замінює старий dashboard або заявки/архів.
Докази локальної зміни: [кроки 1–2 Website Analytics](website-analytics-steps-1-2-evidence.md).

Публічний producer і consent кроку 3 не замінюють dashboard/API, заявки/архів або
Quiz Arena. Інвентар до/після й докази: [крок 3](website-analytics-step-3-evidence.md).

Крок 4 додає тільки публічні producers і окреме analytics-підтвердження після commit
контактної заявки. Маршрути, доступ, формули та дії Admin/Quiz Arena не змінено.
Браузерне приймання підтвердило доступ до заявки через чинний список/API при
зупиненому analytics; нові analytics-події не пишуться у стару статистику чи архів.
Повторені перевірки доступу та точні межі — [докази кроку 4](website-analytics-step-4-evidence.md).

Реєстр: `lib/admin-products.ts`. Новий продукт додає стабільний id, маршрут, окремий контракт, окрему авторизацію джерела та окремі query keys/клієнт. `quiz-arena-provider.tsx` має власний QueryClient, який не ділить кеш із сайтом.

| Продукт | Маршрут | Джерело / стан |
|---|---|---|
| Quiz Arena Bot | `/admin/quiz-arena/dashboard` та вкладені розділи | Явно налаштований backend; Partial |
| Сайт deutschmit.de | `/admin/deutschmit` → `/admin/deutschmit/overview`; `/sessions` та Explorer, `/pages`, `/events`, `/traffic`, `/conversions` всередині Website | Website Analytics v2. `/admin/dashboard` збережений як «Стара статистика сайту»; заявки й архів доступні окремо. [Приймання кроку 5](website-analytics-step-5-evidence.md), [крок 6](website-analytics-step-6-evidence.md) |
| Deutsch Trainer Bot | `/admin/deutsch-trainer` | Каркас; у репозиторії є лише публічне посилання, API статистики не знайдено |
| Сайт Shorts Blocker Kids | `/admin/shorts-blocker-kids` | Каркас; джерело статистики сайту не знайдено; показники застосунку не підставляються |

## Контракт підключення Quiz Arena

- Серверна змінна `QUIZ_ARENA_ADMIN_URL`: базова URL backend, за потреби з `/api`; **не** `/admin`. Немає fallback на публічний URL або `API_INTERNAL_URL`. Немає вбудованих credentials. У production дозволено HTTPS; локально HTTP підтримано для ізольованого стенда.
- Браузер використовує лише `/api/admin/quiz-arena/*`. Кожен запит перевіряє власну сесію сайту, allowlist шляху і методу; кожен запис перевіряє Origin. Невідомий продукт/шлях не проксіюється.
- Вхід у бот — історичний POST `/admin/auth/login` з email/password та `/admin/auth/2fa/verify` з code. Backend продовжує перевіряти сесію і роль на кожній дії; локальний вхід не є заміною його RBAC.
- Cookies backend зберігаються в AES-256-GCM cookie, HttpOnly/SameSite=Strict, шлях лише API бота; ключ прив’язаний до конкретної власної сесії. Пароль не зберігається. Сайтова й сторонні cookies не передаються backend. Підтверджені auth-cookie backend — `qa_admin_access` і `qa_admin_refresh`; лише вони приймаються. Власний Origin-захист шлюзу працює незалежно від backend.
- Для reveal браузер робить POST `promo/{id}/reveal`; шлюз перетворює на історичний GET з `reveal=true` лише після CSRF. Прямі GET-reveal блокуються.
- Cookies/redirect/error bodies backend не виходять у браузер. Помилки мають загальний код, 401/403/429 не маскуються успіхом. Таймаут upstream 15 секунд, browser 20 секунд, redirects заборонені, cache `private, no-store`.
- Усі runtime env треба явно передати процесу сайту. Локальний `compose.yml` передає опційну `QUIZ_ARENA_ADMIN_URL`; цю зміну ще не задеплоєно. Remote код backend не змінено; локальний patch і перевірки описані в backend-verification.md.
- Публічні сторінки/контакти/власна авторизація/власна аналітика не імпортують новий бот-клієнт. Загальні залежності: процес Next.js, ресурси VPS, Caddy/мережа; контакти й аналітика сайту ділять власний PostgreSQL. Бот може мати власні PostgreSQL/Redis/Celery; розміщення на одному VPS не дає ізоляції ресурсних аварій.

## Критерії повного приймання

1. Зафіксовано backend commit a9be50f і прочитані контракти. Підняти ізольований стенд саме цього commit; не використовувати production дані.
2. На синтетичній БД перевірити кожну метрику за контрактом: UTC/Berlin, межі вікон, DST, дублікати подій, пропущені поля, попереднє вікно, порожню БД, лаг кешу.
3. Пройти 7/30/90 днів, обидва users sort, search/page, всі promo status/search/detail tabs. Для кожної мутації перевірити збережений результат повторним GET і audit, cancel, відмову ролі, 2FA, 401/403/429, timeout без автоматичного повтору запису.
4. Звірити cards/series/details за однаковими визначеннями; відомі різні revenue-status фільтри не оголошувати узгодженими. Уточнити нульовий знаменник для кожної частки.
5. У браузері перевірити графіки, tooltips, мобільний layout, переходи, clipboard/CSV; статичний render з mock charts цього не доводить.
6. Вимкнути лише бот-backend: сайт, форми, локальний login та сайтова аналітика мають працювати; у бот-розділі — зрозуміла помилка. Перевірити server RBAC окремо від UI.
7. Перевірити відновлене керування власними й архівними заявками на двох синтетичних сховищах без змішування джерел.
8. Production tag/підключення/розгортання — окремий дозволений етап; міграції, DNS/Caddy та реальні дані не входять у локальне виконання.

## Локальні перевірки

Тести parser/normalization перевіряють контрольні DTO, валідність типів, missing/zero/duplicate та арифметику delta. Тести клієнта перевіряють URL/періоди/фільтри й одноразовість мутацій. Тести шлюзу використовують тільки `example.test`, вигадані сесії та mock fetch. Наявні тести сайту перевіряють авторизацію/контакти/аналітику при вимкненому backend. Підсумкові результати команд додаються після останніх змін.

Додатково за актуальним backend відновлено профіль користувача, bonus/block/unblock/reset_state та ручне refresh сесії. Backend-формули, нові знайдені дефекти й межі CI-доказів: [перевірка backend](backend-verification.md).

## Підсумкові докази локальної перевірки

- `npm test`: **46 файлів, 338 тестів — пройдено**. Включає наявні тести автономності сайту й нові тести API/прав/CSRF/bigint/контактних заявок/помилок статистики.
- `npm run lint`: пройдено.
- `python scripts/verify-quiz-backend-formulas.py`: **21 pure-контроль — пройдено**, без БД/мережі/production.
- `node scripts/verify-admin-http.mjs`: **20 HTTP-контролів — пройдено**. Окремий Next dev + синтетичний HTTP backend: site login без бота, захист API, чотири продукти, точний bigint у mutation/readback, CSRF, вимкнення бота. Власна БД навмисно не налаштована; її 503 перевіряється окремо від бот-збою. Це не браузерний тест графіків і не запуск справжнього FastAPI.
- У загальному CI-проході тести пройшли; typecheck виявив нечіткий nullable return type нового contact store та розширений string у тесті статусів. Типи уточнено без зміни поведінки; фінальний `npm run build` після цього виправлення **пройдено**, включно з ESLint, перевіркою типів і генерацією 37 сторінок. `git diff --check` пройдено.
- Commit/push/deploy/міграції/зміни Caddy/DNS не виконувалися. Реальні дані не читалися й не змінювалися.

На цьому початковому етапі результат був **Partial** через відсутність наскрізного стенда. Наступний прохід нижче замінює цей висновок щодо виконаних перевірок.

## Результат приймального проходу 2026-09-08

**Рішення: автономність сайту підтверджена; повну готовність адміністративної інтеграції до деплою не підтверджено через відтворений дефект backend.**

Стенд: окрема копія backend commit `a9be50f5bf2b688962be65018385d2b832e9412a`, Linux-контейнер, PostgreSQL 16, Redis 7; тільки синтетичні credentials і дані. Backend не має виходу в інтернет. БД `quiz_arena_test` та `site_acceptance_test` розділені. Next production build перевірено через локальний HTTPS, Microsoft Edge/Playwright і реальну TOTP 2FA. Production, DNS/Caddy, реальні дані, commit і push не змінювалися.

| Перевірка | Результат / доказ |
|---|---|
| Frontend unit/regression | 338/338 пройдено; `.verification/frontend-tests.log` |
| Backend admin/API та інтеграційні тести на PostgreSQL/Redis | 162 пройдено, 1 штатний skip недосяжної гілки; `.verification/backend-tests.xml` |
| Порожня й контрольна БД, 7/30/90d | 297 звірок KPI, feature usage, серій, funnel, top products і distributions пройдено; `.verification/seed-and-check.log` |
| Межі SQL, UTC/Berlin, весняний/осінній DST, дублікати/null, підписки, refund, контент, LTV/когорти/покупки | 12 сценаріїв пройдено; `.verification/sql-boundaries-results.json`. Різні фільтри доходу відтворено, а не оголошено однаковими |
| Production browser → HTTPS → шлюз → реальний FastAPI | 25/25 сценаріїв пройдено; `.verification/production-browser-evidence/results.json`, screenshots поруч |
| Дії користувача | bonus energy/streak token/перше premium, block/unblock/reset виконані; повторні GET, entitlement та audit звірено |
| Повторний Premium-бонус | **FAIL:** наявний ACTIVE PREMIUM + bonus premium_days → unique constraint → backend 500 / gateway 502. Джерело: `app/api/routes/admin/users_bonus.py` backend; `.verification/browser-evidence/extra-results.json` |
| Промокоди | create/edit/toggle/reveal/stats/audit пройдено; точний bigint ID збережено. RESERVED redemption після revoke став REVOKED; код лишився active відповідно до контракту; audit збережений |
| Ролі та архів заявок | Зміна ролі й enabled=false відхиляють стару сесію; звичайний admin не отримує raw_code. Архівна заявка змінена й перечитана окремо від власної БД сайту |
| Clipboard/CSV та скасування | Реальний batch у браузері, копіювання й файл CSV збігаються; cancel create/reset не записує дані; вкладки деталей відкриваються. `.verification/browser-evidence/UI-results.json` |
| Сайт при фактично зупиненому Quiz Arena | Публічні сторінки, заявки, зміна статусу через UI, повторний login та аналітика 7/30/90 працюють. SQL звірено на тому самому generated_at. Бот-розділ показує помилку без старих графіків. `.verification/browser-evidence/outage-results.json` |
| Build/lint/TypeScript | Успішні в ізольованій копії без читання `.env.local`; `.verification/build.log`, `lint.log`, `typecheck.log` |

Локальні зміни цього проходу: `compose.yml` тепер передає опційну `QUIZ_ARENA_ADMIN_URL`; тестова `.verification/` виключена з Git, Docker build context, ESLint і TypeScript; додано `scripts/prepare-admin-acceptance.mjs` та `scripts/verify-admin-browser.mjs`. Код сторінок і backend у цьому проході не змінювався. Тимчасову неповну backend-копію прибрано зі списку вкладених Git-репозиторіїв; її 1720 позначок не стосувалися основного проєкту.

Обмеження висновку: перевірено функціональну автономність від API бота, а не стійкість спільного VPS до аварії хоста/мережі. Архів заявок у боті навмисно потребує backend бота. Реальні production-конфігурація, image tag, TLS/DNS і ресурси не перевірялися. Точний облік витрат токенів цьому виконавцю недоступний.

На момент цього приймального проходу обидва backend-дефекти лишалися відкритими. Результат наступного локального виправлення — у [доповненні](backend-verification.md#локальне-виправлення-двох-дефектів). Перевірка фактичного production-підключення залишається окремим етапом.

## Приймання Website v1: крок 7 (2026-09-13)

Локальне приймання завершено на синтетичних ізольованих PostgreSQL і справжньому
браузері: 297 SQL-звірок Quiz-метрик за 7/30/90 днів, 25 browser перевірок
login/2FA, користувачів і промокодів із persisted readbacks пройшли. Раніше
задокументовані backend/RBAC обмеження цією задачею не виправлялися.

Фінальні 9 Website reports груп, 12 actions груп і три окремі dependency outage
сценарії пройшли. Під кожною відмовою обидві форми зберегли заявки з SQL readback;
власний login, сайт і доступ до інших продуктів збережені. Шість звітів, стара
статистика, заявки/архів і чотири продукти залишаються доступними без змішування
даних. Фінальні SQL-контролі — 9/9; Overview/Sessions на 100000 подіях мають
максимум 798.7/177.3 ms.

Версія збірки, межі доказів, запуск і повернення записані в
[чинному протоколі](statistics-manual-verification.md). Production env/дані,
commit і deploy не використовувалися; фактичне перемикання не виконане.


### PR #22 review fixes — 2026-09-13

Quiz Arena now exposes /admin/quiz-arena/requests in its navigation. The page reads and updates the existing backend contact-requests source, checks the returned status and refreshes the list; Website requests retain their separate site source. An unavailable source is displayed as an error.

Legacy analytics now checks the configured same origin and fetch metadata, bounds declared and streamed JSON bytes, and allows 60 requests per minute per client. Contact persistence allows 5 and administrator login 10 requests per minute per client. These are bounded in-memory limits per process, not distributed quotas. Production contact/login require a valid trusted client address. Caddy overwrites X-Forwarded-For with its direct peer address and remains the only published entrypoint; ANALYTICS_TRUST_PROXY=1 relies on that boundary. IP bucket keys are salted hashes held only in memory.

Verification: 104 passing targeted tests across the original successful five suites and the four corrected suites; TypeScript and changed-file ESLint passed. Caddy configuration validated in an isolated local container. UI tests cover navigation, separate sources, status write/readback and unavailable-source rendering with mocked APIs; proxy tests cover routing. This evidence does not represent a live backend/SQL or production rollout test.
