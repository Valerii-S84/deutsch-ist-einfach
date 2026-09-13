# Website Analytics — приймання кроку 5, 2026-09-13

**Done на ізольованому локальному стенді.** Overview, Sessions та Session Explorer
реалізовані й перевірені. Production/deploy/commit не виконувалися.

## Що завершено

- Явний `/admin/deutschmit` веде на Overview; Website більше не є `[product]`-каркасом.
  Sessions і Explorer доступні в меню Website разом із заявками/архівом та окремою
  «Старою статистикою сайту». Старі API, формули й адміністративні дії збережені.
- SQL-звіти винесені в `services/analytics/src/reports.ts`. Періоди 7/30/90 UTC-днів,
  весь денний ряд, top pages, 50 сесій на сторінку, фільтри періоду/сторінки/події.
- Виправлені active time без вимірів (null), campaign без source, незмінне джерело
  входу, перша/остання спостережувані сторінки без обов'язкового page_view, неповна
  історія та timeout при читанні. Пізнє server success не продовжує активність.
- Деталі повертають усю збережену сесію; початковий ліміт 1000 подій прибрано.
  Події поза періодом позначаються. Browser sequence й прив'язка server success до
  submission attempt визначають порядок; немає replay, visitor-профілів чи worker.
- Захищені handlers і `analytics-service-client` з перевіркою DTO/фільтрів;
  `private, no-store`. Loading, нуль, відсутність історії, unavailable і stale snapshot
  мають різні стани. Є ручне оновлення та таймер застарілості понад п'ять хвилин.

## Перевірені результати

| Контроль | Результат |
|---|---|
| Розділ 6 плану, 7/30/90 | **2 visitors / 3 sessions / 4 views / 1 Telegram / 1 analytics-заявка** однакові в незалежному SQL, сервісі, Next API та UI; усі 7/30/90 денних рядків видимі |
| Contact success та повтори | Справжній синтетичний contact commit → server success. Honeypot не додає success; повторні event IDs і семантичні дублікати views/quiz/success не збільшують відповідні counts |
| Сесії | `/wissen` active 30/60 → **60 с**; campaign `test` збережена без utm_source; відсутній вимір → null, вимір 0 → 0 |
| Timeout / неповнота | Browser timestamps перенесено на 31 хв у минуле; новий read повертає timed_out без worker, попри пізніше server success. Нова browser activity → active; відсутній start/sequence → incomplete |
| Межі й довга сесія | Подія перед початком 7d лишається в Explorer з позначкою; при 30d позначка зникає. **1101/1101** подій отримано API і показано UI |
| Пагінація / фільтри | 54 сесії → 50 + 4 без повторів. Спільний path/event filter, скидання сторінки та перехід до порожньої вибірки перевірені в API/UI |
| Реальна браузерна сесія | `/wissen` → `/`, scroll 25/50/75/90, engagement, Telegram, page_leave, наступний view; **24 події, 32 455 ms, 2 views, 1 click**. Послідовність видима в Explorer |
| Стани | Порожнє сховище відрізняється від нульового періоду; затриманий запит показує loading без чужих counters. Старіння й ручний refresh перевірені браузером і unit-тестом |
| Зупинка analytics | Справжній процес зупинено: три нові API → 503, UI → unavailable без нулів. Старий API → 200, старий dashboard, заявки/архів та product picker доступні |
| Інші продукти | **7/7** product-picker/admin browser groups: login, захист сторінок/API, всі продукти, Quiz Arena меню та окрема авторизація, 404 |

## Середовище й команди

Next production build `upX2EUXvUH_MQqJkpRf_Z`, локальний HTTPS, Edge headless,
PostgreSQL 16 на наявному Compose-стенді. Runner створює й після завершення видаляє
власну випадкову SQL-схему; попередні `public.analytics_events`, legacy-рядки та
контакти не видаляє. Синтетична заявка з контрольного сценарію лишається в тестовій
contact DB. Читання `.env` і production-даних не використовувалося.

| Команда | Доказ у `.verification/website-analytics/` |
|---|---|
| `node scripts/prepare-analytics-acceptance.mjs test` | 499/499, 61 файл; `step-5-tests.log` |
| Адресний запуск нових/доповнених service-client, detail handler та analytics-ui тестів тим самим runner | 15/15; `step-5-added-tests.log` |
| Runner `lint`, `typecheck`, `build` | PASS; `step-5-lint.log`, `step-5-typecheck.log`, `step-5-build.log` |
| `node node_modules/typescript/bin/tsc -p services/analytics/tsconfig.json` та Docker build сервісу | PASS |
| `node scripts/verify-analytics-reports.mjs` | **8/8**; `step-5-acceptance.log`, `step-5/results.json`, `control.json`, `real-session.json`, screenshots |
| `node scripts/verify-product-picker.mjs --production` | **7/7**; `step-5-admin-regression.log` |
| `git diff --check` | PASS; CRLF-попередження не є whitespace errors |

Для відтворення звітів після build потрібні наявні тестові БД, service TypeScript build,
`node scripts/prepare-analytics-acceptance.mjs start --reports` та
`node scripts/analytics-acceptance-https.mjs`. Report runner сам запускає й зупиняє
синтетичний service на localhost:45441. Потім запустити `verify-analytics-reports.mjs`.

Проміжні невдалі прогони не зараховані: виправлено відсутнє обов'язкове поле
синтетичної форми, дочекалися фінального browser flush перед часовим fixture та
встановили тестовий clock до монтування timer-компонентів. Підсумкові 8 груп пройшли,
browser exceptions — 0. Next, HTTPS helper і чотири тестові контейнери зупинені.
Контракти — [statistics-contract.md](statistics-contract.md#overview-та-sessions-крок-5).
