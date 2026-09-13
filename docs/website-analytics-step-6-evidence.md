# Website Analytics — докази кроку 6

Дата: 2026-09-13. Локальну реалізацію кроку 6 завершено та перевірено.
Production не змінювався; commit і deploy не виконувалися.

## Результат і збережений доступ

Додано Pages, Clicks/Events, Traffic, Conversions у `/admin/deutschmit/` і чотири
явні авторизовані handlers під `/api/admin/analytics/deutschmit/`.
SQL працює в тому самому analytics service з тією самою таблицею подій.
Нових подій, продуктових процесів, БД, міграцій або підключених продуктів немає.

Навігація містить шість звітів та окремі посилання на збережені
`/admin/dashboard` і `/admin/deutschmit/requests`. Overview, Sessions, timeline,
заявки/legacy-архів, picker та можливості інших продуктів збережені.
Адаптер, авторизація, 2FA, статистика й дії Quiz Arena не змінювалися.
Початковий інвентар — карта в `admin-restoration.md`; її рядок Website доповнено
новими маршрутами, решта продуктів збережена. Регресійний запуск охопив чинні
picker/layout/dashboard, Quiz Arena pages/proxy, contact API та legacy store тести.

Кожен звіт веде до Sessions зі strict selection та періодом. Форми й quiz мають
окреме посилання з кожного лічильника. Sessions показує активний фільтр, дозволяє
його прибрати та відкриває чинний timeline. SQL перевіряє точну відповідність IDs
для сторінки, event, element/placement, error, entry dimensions, form, quiz та intent.

Формули, UTC-вікна, джерело, дедуплікація, свіжість і межі охоплення описані в
[контракті метрик](statistics-contract.md#прикладні-звіти-website-крок-6).

## Контрольний приклад

Реальний тимчасовий PostgreSQL 16, лише синтетичні події й випадковий ізольований
schema. Використано чинну міграцію таблиці; schema прибрано тестом, контейнер
`deutschmit-step6-sql` зупинено з автоматичним видаленням після перевірок.
Жодного доступу до production або наявних контактних/ботових БД.

Для 7/30/90 UTC-днів підтверджено контроль розділу 6 плану:

- 2 visitors, 3 sessions, 4 page views, 1 Telegram click, 1 analytics-заявка.
- `/wissen`: 30 і 60 секунд cumulative дають 60 секунд, один виміряний view.
- Стаття: scroll 90%, 60 секунд, одна ознака дочитування; один завершений quiz run.
- Direct: 2 sessions; campaign `test`: 1 session, 1 server success.
- Натиснутий CTA: 1/1; інший CTA: 0/1. Повторні event IDs та семантичні
  повтори views/impressions/scroll/article/quiz/success не збільшують відповідні числа.
- Forms: один open, два submit, один success; додатковий submit не створює success.

Окремі SQL-контролі перевірили реальний повторний click; click до impression;
відсутній impression та інше placement; frontend code; form error; окремі
YouTube/Amazon/download intents; UTC-межу з точністю до мілісекунди;
виключення майбутніх подій; view-start cohort активного часу; пізні виміри;
нульовий та відсутній вимір; impression поза вікном; entry поза вікном;
відсутній session_start; direct/unknown; незмінність entry при внутрішній навігації;
distinct conversion ID у traffic-групі навіть при повторі в іншій сесії;
read-time timeout; порожнє джерело, порожній період і недоступну БД.

API-тести чотирьох явних Next handlers перевірили 401 до виклику сервісу,
400 для зайвих/дубльованих/невалідних параметрів, правильний період,
private/no-store і 503 без приватного тексту помилки. Внутрішні handlers сервісу
додатково перевірені на реальному SQL.

UI-контролі перевірили всі report links і їхні selectors/періоди, URL → Sessions
request, відображення чисельника/знаменника та «не визначено» для 0/0.
Для кожного з чотирьох звітів під час асинхронної зміни періоду приховано і стару
відповідь, і раніше кешовані дані нового періоду; показ з'являється після відповіді.
Помилка ручного оновлення також приховує попередні числа.

## Виконані перевірки

| Перевірка | Результат |
|---|---|
| Початковий цільовий регресійний Vitest запуск | 347 passed, 38 files; включав API-контролі та збережені адміністративні функції |
| Фінальні SQL/UI тести після останніх правок | 20 passed, 0 failed, 0 skipped: 8 SQL, 6 нових UI, 3 чинних analytics-ui та 3 тести незміненої копії analytics-ui у `.verification` |
| `npm run typecheck` | OK після виправлення типізації адрес Next Link |
| `npm run analytics:build` | OK після останньої зміни SQL |
| ESLint усіх 25 змінених/нових TS/TSX файлів задачі | OK |

Vitest зіставив також збережені локальні копії у `.verification`; загальні числа
не оголошуються кількістю унікальних поточних source-тестів. Актуальні нові тести:
8 SQL + 6 UI + 5 API. Успішні API/регресійні тести після незмінного коду не повторювалися.

Фінальна команда SQL/UI (при запущеному тестовому PostgreSQL):

```powershell
$env:ANALYTICS_STEP6_POSTGRES_TEST='1'
node node_modules/vitest/vitest.mjs run 'services/analytics/src/application-reports.test.ts' 'app/(admin)/admin/(secure)/deutschmit/application-report.test.tsx' 'app/(admin)/admin/(secure)/deutschmit/analytics-ui.test.tsx' --reporter=json --outputFile=.verification/step6/relevant-tests.json
```

SQL lane навмисно opt-in: без `ANALYTICS_STEP6_POSTGRES_TEST=1` звичайний unit test
запуск не потребує PostgreSQL. Єдина тестова адреса — localhost:45446,
`deutschmit_analytics`, `analytics_user`, пароль `synthetic-step6-only`.
Для відтворення можна запустити окремий disposable контейнер:

```powershell
docker --config .docker-test-config run --detach --rm --pull never --name deutschmit-step6-sql --publish 127.0.0.1:45446:5432 --env POSTGRES_USER=analytics_user --env POSTGRES_PASSWORD=synthetic-step6-only --env POSTGRES_DB=deutschmit_analytics postgres:16-alpine
# Після готовності PostgreSQL виконати SQL/UI lane вище, потім:
docker --config .docker-test-config stop deutschmit-step6-sql
```

Локальні журнали: `.verification/step6/tests.log`, `relevant-tests.json`,
`types-final.log`, `build-final.log`, `lint.log`.

## Межі доказів

UI перевірено React DOM/SSR тестами; новий наскрізний запуск Next у браузері,
візуальне приймання й повний production build сайту тут не виконувалися.
Ці докази не замінюють наскрізне приймання кроку 7 або окремо дозволений deploy
кроку 8. Наявні застереження щодо повного backend/RBAC приймання Quiz Arena
у `admin-restoration.md` залишаються чинними.
