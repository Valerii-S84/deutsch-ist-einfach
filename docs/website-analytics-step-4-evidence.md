# Website Analytics: докази кроку 4

2026-09-09. **Done для локального кроку 4.** Усі погоджені критерії «готово»
підтверджено; обмеження й окреме невирішене спостереження про від'єднання контактної
БД наведено нижче, без твердження про їх виправлення.

Обсяг, підтверджений користувачем після виправлення описки: тільки локальний крок 4.
Кроки 5–8, production, реальні дані, commit/push не виконувалися. Початковий
`git status --short` порожній; базовий HEAD `9846f43`. Прочитано `AGENTS.md`,
`.agent/AGENTS.md`, застосовні core/project правила, план, контракти статистики,
адміністративного контролю та попередні докази. Нових правил у вкладених каталогах немає.

## Реалізація та критерії «готово»

| Вимога | Реалізація та виконаний доказ |
|---|---|
| Кожен із 15 типів записується у БД | `scripts/verify-analytics-actions.mjs`: **12/12 груп**, фінальний readback **125 подій усіх 15 типів**; SQL і захищений session API мають однакові event IDs |
| Основні CTA, меню, статті, проєкти, Telegram, Amazon, APK | Стабільний реєстр `lib/analytics/elements.ts` і data-атрибути. Explicit-кліки пропускаються делегованим handler; browser перевірив рівно два окремі header clicks, по одному потрібному project click, обидва Amazon intents та impressions |
| Обидві форми | Реальні student і partner wizard → POST Contact API → окремий site PostgreSQL; по одному рядку й одному `source=server` success, правильні form/instance/attempt/page-view IDs. Клієнтського success немає |
| Повторна спроба форми | Network abort першого student submit → form_error → новий attempt ID при retry, той самий instance. Повторне відкриття має новий instance; синхронний guard блокує double submit під час надсилання |
| Невалідний analytics-контекст | Strict parser відокремлює контекст від контактної схеми. Unit/API перевіряє malformed/denied/wrong form/extra fields; browser HTTP з extra email у контексті повертає 202 і зберігає контакт без analytics success |
| Honeypot і помилка контактної БД | Honeypot: 0 контактів, 0 success. Справжній PostgreSQL CHECK rejection лише для синтетичного контакту: видимий form_error, 0 контактів, 0 success. Тимчасове обмеження знято; повторний SQL-контроль показав 0 залишкових constraints |
| Analytics outage не губить заявку | При зупиненому analytics збережено partner-заявку, UI показав успіх, існуючі `/admin/deutschmit/requests` та GET contact-requests повернули цей самий запис; analytics success відсутній |
| Один обмежений server sender | Виклик тільки після завершення save; окремі випадкові event/conversion UUID, без ID заявки. Fetch/читання body обмежені 500 мс; unit із контрольним годинником і адаптером, що ігнорує abort, підтверджує повернення через 500 мс без retry. Журнал містить тільки `analytics_contact_delivery_failed` |
| Quiz | Справжня curated-гра з п'ятьма відповідями у браузері → один start і один complete з однаковим run ID; reload не додає complete. Unit перевіряє resume/reload/dedup і відсутність збереження окремих відповідей |
| Impressions / scroll / engagement | Unit перевіряє межу 50%/1 с, скидання dwell у hidden, одноразові 25/50/75/90 і cumulative updates 30/60 с. Browser перевірив impressions, усі чотири пороги та два engagement samples із проміжком ≥30 с |
| Article read | Browser використав **реальні ≥60 с** активного часу. Footer при згорнутих секціях не створив read; відкриття і послідовне охоплення тіл секцій створило рівно один read. Unit окремо відхиляє просто відкриті, але не охоплені секції |
| Frontend errors | Browser отримав рівно 5 фіксованих `js_error` після 7 тестових errors; жодного message/stack. Unit перевіряє reset ліміту на новий view та unhandled rejection; quiz mapper передає тільки код/component |
| Consent і приватність | Browser pending/deny/revoke не створюють нові tracking IDs/події; revoke очищає quiz state в іншій вкладці. При blocked storage форма успішно зберігається без analytics-контексту. SQL і доступні captured payloads не містять тестових контактів/текстів/помилок/query/hash/відповідей quiz |
| Збереження даних і контролю власника | Фінальний сценарій додав лише **5 синтетичних контактів**, зберіг усі **16 попередніх контактних рядків** і **5 legacy analytics рядків** без змін. Всі 7 product-picker/admin browser groups пройшли |

Публічні статичні сторінки залишилися server components/SSG. Змінено публічні
компоненти, browser runtime/спостереження, контактний transport/parser, окремий
server sender і відповідні перевірки. Адміністративні сторінки, Quiz Arena adapter,
API/формули/ролі/2FA/дії, контактне сховище та його продуктові міграції не змінено.

## Явні рішення для старих назв

| Стара назва | Рішення у v1 |
|---|---|
| hero_cta_click / channel_cta_click / quiz_teaser_cta_clicked | element_click із дозволеними element/placement/destination; довільний старий payload не копіюється |
| wizard_open | form_open із фактично змонтованої форми; entry buttons більше не дублюють цю подію |
| quiz_teaser_started / quiz_teaser_completed | quiz_started / quiz_completed; той самий випадковий run ID, тільки агреговані counts |
| quiz_teaser_error | frontend_error із component=quiz і фіксованим кодом |
| quiz_teaser_question_answered | Поза v1; виклик із відповідями прибрано, game progress лишився |
| lead_submit_success | Клієнтський виклик прибрано; тільки server form_success після commit |

Повний контракт producer: [statistics-contract.md](statistics-contract.md#важливі-дії-та-contact-api-крок-4).

## Перевірки й відтворення

Сайт — локальний Next production build **`t1dvIrATCl76IZQnyOvyX`**, режим `new`,
`https://localhost:44453`; Edge **152.0.4191.66** headless. Окремий Compose project
`website-analytics-acceptance`, окремі site/analytics PostgreSQL 16. Runner створює
ізольовану копію без `.env*` і передає тільки синтетичну конфігурацію. Зовнішня
мережа браузера заблокована; Telegram/Amazon/інші зовнішні сторінки не відвідувалися,
APK фактично не завантажувався — перевірено саме click intent.

| Запущена команда | Результат / артефакт у `.verification/website-analytics/` |
|---|---|
| `node scripts/prepare-analytics-acceptance.mjs test` | **487/487, 59 файлів**, `step-4-tests.log` |
| Адресний повтор `test lib/analytics/browser.test.ts` після уточнення очікування flush | PASS, `step-4-browser-unit.log`; наступний повний запуск вище також пройшов |
| Той самий runner `lint` | PASS, `step-4-lint.log` |
| Той самий runner `typecheck` | PASS, `step-4-typecheck.log` |
| Той самий runner `build` | PASS, `step-4-build.log`; після цього лише форматування client-коду, тести, runners і документація |
| `node node_modules/typescript/bin/tsc -p services/analytics/tsconfig.json` | PASS |
| `docker --config .docker-test-config build -f services/analytics/Dockerfile -t website-analytics-acceptance:local .` | PASS, включно з сервісним npm build; manifest `sha256:ed5f1eda06fdb47b295bc257bde694eddc3bef105ce9411226777ba9984c1bdd` |
| `node scripts/verify-analytics-actions.mjs` | **12/12**, `step-4-actions.log`, `step-4-browser/results.json`, `sql-events.json`, `analytics-requests.json`, screenshots books/article/request-during-analytics-outage |
| `node scripts/verify-product-picker.mjs --production` | **7/7**, `step-4-admin-regression.log`; anonymous pages/APIs, login/picker, усі продукти, старі статистика/заявки/архів, меню Quiz і 404 |
| `node scripts/verify-analytics-browser.mjs` | **12/12**, `step-4-lifecycle-regression.log`; копії фінальних `results.json` і `requests.json` у `step-4-lifecycle-browser/`. SPA/reload/back/forward/BFCache, клони вкладок, timeout, consent/storage, offline/retry/outage. 157 збережених events перевірено на відсутність Admin paths; 0 browser exceptions. Для 1 із 34 запитів Chromium не надав тіло beacon |
| `git diff --check` | PASS; CRLF-попередження Git не є whitespace-помилками |

Не видаємо unit/mocks за PostgreSQL чи browser evidence. Повторного повного аудиту
FastAPI/SQL метрик Quiz Arena і попередніх 14 груп кроку 2 не проводили; їхні історичні
докази й невирішені backend-питання лишаються чинними. Поточні unit/API регресії Quiz
входять до 487 тестів; збереження маршрутів і доступу підтверджене в браузері.

## Невирішені питання та межі

- **Від'єднання контактної БД:** у проміжному browser-прогоні повна зупинка site-db
  залишила контактний запит без видимого результату понад 25 с. Причину й загальний
  HTTP timeout такого outage цим кроком не виправлено/не підтверджено. Після відновлення
  контрольний запит цього сценарію не знайдено у site DB. Обов'язковий сценарій
  невдалого збереження перевірено окремо справжньою SQL-відмовою, а не HTTP mock.
- Доставка success — одна спроба без outbox; після contact commit можливі втрати
  analytics. Повний список заявок лишається операційним джерелом, не analytics total.
  Revoke не скасовує уже відправлений контактний запит/commit або beacon.
- Run, початок якого не спостерігався після згоди, не відновлюється з game progress.
  Покриття статті є приблизною ознакою; responsive reflow може вимагати повторного
  охоплення секції. Дані дій — спостереження, не доказ читання, покупки чи підписки.
- Чинного YouTube-посилання не знайдено в `app/`, `lib/`, `content/`. Destination
  підтриманий схемою/реєстром, але реального YouTube browser-переходу немає; новий URL
  або канал не вигадувався. Це не пропущений чинний handler.
- Browser acceptance — Edge; нативне меню Duplicate, Firefox/Safari окремо не
  перевірялися. Геометрична видимість перевіряється кожні 250 мс, із додатковою вимогою
  фокусу; це консервативне спостереження, не визначення того, на що людина дивилася.
- Next dev нестабільність із попередніх доказів не ремонтувалася. Приймання — локальний
  production-режим; warnings про кілька lockfiles перевірочної копії та Browserslist
  не завадили build. Це не доказ стану deployed production.

Проміжні невдачі не рахуються як успіх: sandbox не дозволив Docker у першому runner;
потім уточнено SQL fault injection, змінний локатор відкритих секцій і очікування
старого lifecycle runner щодо додаткових events/batches. Окремий короткий browser
reproducer показав запуск init-script на inherited `about:blank` перед `/wissen`;
тестові читання storage тепер допускають opaque provisional documents, а обов'язкова
звірка скопійованої сесії до hydration збережена. Для beacon автоматизація
Chromium може не віддати request body; відсутній capture не вважається перевіреним
payload, збережені події незалежно перевіряються через SQL.

Підсумок browser-приймання: **31 група** (12 важливих дій + 12 lifecycle + 7 admin).
Запущені для задачі Next та HTTPS helper зупинено; їхні listening ports 43828/44453
відсутні. Чотири контейнери синтетичного Compose-стенда зупинено, volumes та
артефакти збережено. Commit/push/deploy не виконувалися.
