# Website Analytics: крок 3

2026-09-09. **Обидва P2 з повторного аудиту виправлено; адресне приймання пройдено.**
Висновок щодо виправлень: готові до коміту та локального приймання кроку 3 разом
із попередніми доказами аудиту. Commit/push і production не виконувалися.

## Виправлення після аудиту

1. `lib/analytics/identity.ts`: вільний Web Lock більше не є достатньою підставою
   відновити скопійований session ID. Перевіряється попередній документ вкладки
   через Navigation API; `performance.timeOrigin` зберігає можливість повторного
   запуску трекера в тому самому документі. Lock додатково відсікає активного
   іншого власника. Без Navigation API застосовується обмежений fallback
   reload/back_forward, а звичайний новий документ починає нову сесію.
   Семантика попереднього документа: [HTML Standard, NavigationActivation](https://html.spec.whatwg.org/multipage/nav-history-apis.html#navigationactivation).
2. `lib/public-analytics-client.ts`: 90-денний строк visitor ID застосовується й до
   типового `legacy`. Дата створення зберігається окремо разом з відповідним ID;
   звичайні звернення не продовжують строк. Старий ID без відомого віку, невалідна
   дата або невідповідність ID спричиняють заміну. Формат старого string ID і API
   збережені. Provider видаляє також запис віку при deny/revoke; privacy уточнює,
   що заміна відбувається при наступній події після спливу строку.

| Адресна перевірка після виправлень | Результат |
|---|---|
| `node scripts/prepare-analytics-acceptance.mjs test lib/analytics/identity.test.ts lib/public-analytics-client.test.ts lib/analytics/browser.test.ts "app/(public)/analytics-provider.test.tsx"` | **40/40 PASS**, 4 файли; `.verification/website-analytics/step-3-p2-focused.log` |
| Edge 152.0.4191.66, Next production, локальна HTTPS і PostgreSQL 16: `/privacy → grant → /admin/login → window.open('/wissen')` | **PASS**. Runner спочатку підтвердив, що lock вільний і sessionStorage справді скопійовано до hydration. Popup отримав того самого visitor, іншу session, власні start/view/click із sequence 1/2/3 у SQL; наступний reload зберіг нову session. Група `cloned tab after Admin navigation and released lock starts its own session` у `step-3-browser/results.json` |
| `node scripts/verify-analytics-legacy-browser.mjs` | **3/3 PASS**; `step-3-p2-browser-legacy.log`, `step-3-legacy-browser/results.json`. Реальний legacy client зібрано наявним Rolldown і виконано в ізольованому localhost-документі Edge: перед 90 днями ID незмінний, на 91-й день новий, дата не продовжується; старий ID без віку замінюється. Контрольований Date.now, без Next build для legacy, реального очікування 91 день чи записів до БД |

Також уже виконано: **456/456 тестів, 57 файлів**, lint, typecheck, типи сервісу
(`--noEmit`) та production build режиму `new` — PASS. Логи:
`step-3-p2-tests.log`, `step-3-p2-lint.log`, `step-3-p2-typecheck.log`,
`step-3-p2-service-types.log`, `step-3-p2-build-new.log`.
Новий legacy runner після остаточного редагування перевірено окремим ESLint.

Зайвий загальний browser-прогін **не є повністю успішним**: 11 груп пройшли,
включно з адресним P2, реальним BFCache та outage. Остання група runner-а впала
на `request.body.events`, бо Playwright повернув `null` для тіла одного запиту.
Це не заважає окремому SQL-доказу P2; повного нового browser PASS не заявляємо.
Загальний прогін не повторювався після уточнення користувачем меж задачі.
Старі 11/11 нижче — історичний результат 2026-09-08; `step-3-browser/results.json`
тепер містить поточний прогін, а попередній лог `step-3-browser-final.log` збережено.

Зміни P2 не зачіпають service/SQL/API, формули, заявки, архів чи Quiz Arena.
Повне PostgreSQL-приймання кроків 1–2 та окремий повтор product picker не запускалися;
для них залишаються попередні докази й результати наданого аудиту.
Нативне меню Duplicate, Firefox і Safari цим виправленням окремо не перевірялися.

## Попереднє приймання 2026-09-08 (до повторного аудиту)

2026-09-08. Попередній статус: **Done для локального кроку 3**; згодом аудит виявив
два P2, виправлені вище. Перевірено Next.js production build
через локальний HTTPS, Microsoft Edge 152.0.4191.62/Playwright, Analytics service
та окрему PostgreSQL 16. Усі дані й credentials синтетичні. Крок 4, production,
реальні дані та commit/push не виконувалися.

Перед роботою прочитано AGENTS.md, .agent/AGENTS.md, застосовні core/project правила,
план, контракти статистики й адміністративного контролю та докази кроків 1–2.
Їхні наявні незакомічені зміни збережено. Нових залежностей, API, таблиць,
міграцій або адміністративних сторінок цей крок не додає.

## Реалізація та критерії «готово»

| Вимога кроку 3 | Реалізація / доказ |
|---|---|
| До згоди немає IDs, черги чи replay | Provider відкидає дії pending/denied. Browser: до grant немає analytics-запитів/IDs; після grant лише поточні start/view та новий клік, разом 3 SQL-рядки |
| Постійні налаштування, deny/revoke/regrant | Кнопка в обох footer-компонентах; privacy описує фактичний збір. Storage/BroadcastChannel синхронізують рішення. Browser: revoke очищає IDs усіх трьох вкладок, зупиняє події; regrant створює нового visitor |
| Visitor/session/page IDs | `identity.ts`: випадкові UUID; visitor 90 днів, session однієї вкладки 30 хвилин, sequence зберігається при reload. Browser: нова та клонована через window.open вкладки мають спільного visitor й різні session IDs |
| Реальні перегляди та Telegram доходять до нової БД | `browser.ts`: session_start/page_view/page_leave та element_click для чинних Telegram callbacks. SQL: `/ → /wissen → / → /wissen → reload` дає 5 різних views, одну session і 4 leave; порядок sequence без повторів |
| Реальний BFCache | Browser зафіксував `pageshow.persisted=1`; `/privacy → /impressum → back` дає рівно 3 views й одну session. Виправлено гонку visibility/focus перед pageshow; окремий regression test відтворює цей порядок |
| Таймаут і час | Unit fake clock: наступна дія на відкритій сторінці після 30 хвилин створює start/view із новою session; active time обмежений 60 с idle, hidden не додає часу. Browser: штучно зістарений синтетичний sessionStorage перед hydration дає нову session при reload |
| Один обмежений transport | `transport.ts`: fetch, ≤20 подій/32768 UTF-8 bytes, ≤100 у пам’яті, TTL 5 хв, flush 10 с/Telegram; timeout 5 с. Unit: retry лише network/429/5xx, затримки 1/5/15 с, максимум 3 повтори, IDs незмінні; abort/очищення після revoke |
| Повтор не дублює перегляд | Browser: перший запит справді COMMIT-иться, runner підміняє відповідь на 503. Другий запит має ідентичне тіло; у PostgreSQL лишається 3 рядки, а не 6. Beacon не трактується як підтвердження; unit перевіряє повтор тих самих IDs при відновленні |
| Сховище/offline/outage не ламають сайт | Browser: storage denied → без збору, навігація/кліки/налаштування працюють. Offline → доставка після відновлення. Фактично зупинений тестовий Analytics →503; публічна навігація, revoke та власний admin login/dashboard доступні |
| New/legacy/off та розділені сховища | Єдиний build-параметр `NEXT_PUBLIC_WEBSITE_ANALYTICS_MODE`; типовий режим legacy. Unit перевіряє всі режими й відсутність Admin-збору. У new browser усі 22 analytics-запити йдуть лише в новий endpoint; повні SQL snapshots contact_requests і website_analytics_events незмінні |

Новий режим має окрему згоду `deutschmit_analytics_consent_v2`: старий grant не
переноситься автоматично. Entry UTM/referrer очищаються спільними функціями й не
перезаписуються SPA-навігацією. Browser перевірив `instagram / paid-social /
Herbst-Kurs-2026`; query/hash і довільний Telegram URL у payload не потрапляють.
Решта producers (форми, quiz, impressions, engagement, scroll_depth, article_read,
frontend_error) залишаються кроком 4; нових звітів немає.

## Збереження адміністративного доступу

До/після лишилися `/admin/products`, `/admin/deutschmit`, `/admin/dashboard`,
`/admin/deutschmit/requests` із site/legacy, усі меню Quiz Arena
dashboard/users/content/economy/promo/system/login, його окремі auth/2FA та адаптер.
`verify-product-picker.mjs --production`: **7/7 PASS** — власний login, усі продукти,
перемикання, старі сторінки/архів, захищені сторінки/API, 404 невідомого продукту.
Формули, backend та адміністративні мутації не змінювалися; їхня unit-регресія
проходить. Попередній повний аудит реального Quiz backend не повторювався;
його відомі межі залишаються в чинних контрактах.

## Виконані перевірки

Артефакти — `.verification/website-analytics/` (ігноруються Git).
Runner відтворення та перемикач режиму описані в `services/analytics/README.md`.

| Команда | Фактичний результат / артефакт |
|---|---|
| `node scripts/prepare-analytics-acceptance.mjs test` | **436/436**, 56 файлів; `step-3-tests.log` |
| Адресний повтор після останньої BFCache-правки: той самий runner `test lib/analytics/browser.test.ts app/(public)/analytics-provider.test.tsx` | **14/14**; `step-3-lifecycle-recheck.log`. Повний попередній запуск не видається за запуск після цієї правки |
| Той самий runner `lint`, `typecheck`, `build` після фінальної правки | **PASS**; `step-3-lint.log`, `step-3-typecheck.log`, `step-3-build.log` |
| `node node_modules/typescript/bin/tsc -p services/analytics/tsconfig.json` | **PASS**, збірка сервісу; його source/контракт не змінено |
| `node scripts/verify-analytics-browser.mjs` після фінальної правки | **11/11 PASS**, один повний запуск; `step-3-browser-final.log`, `step-3-browser/results.json`, `requests.json` |
| SQL-readback сесії після browser run | 16 рядків: 5 views, 6 окремих фізичних clicks, 4 leave, 1 start; `step-3-browser/sql-session.json` містить також build ID |
| `node scripts/verify-product-picker.mjs --production` | **7/7 PASS**; `step-3-admin-regression.log` |
| `git diff --check` | **PASS**; наявні CRLF-попередження Git не є whitespace-помилками |

Під час роботи виправлено відсутню кнопку в окремому footer головної та гонку
BFCache. Невдалі проміжні browser-прогони не є доказом успіху. Коригування runner-а:
фактичне посилання Wissen, старіння sessionStorage після pagehide, очікування
pageshow/commit замість load при BFCache. Фінальні 11 груп пройшли разом.

## Межі й невирішені питання

- Доставка best effort: закриття вкладки, ліміти, TTL або outage можуть втратити
  події. Revoke зупиняє майбутню роботу, але не скасовує вже відправлений beacon
  чи COMMIT; видалення збереженої історії є окремою операцією.
- При недоступному localStorage/sessionStorage новий збір вимикається. Без Navigation API
  session іншого документа відновлюється лише для reload/back_forward; повний перехід документа може
  почати іншу session. Це межі спостережень, а не виміряна нульова активність.
- Перевірено Edge та справжнє клонування sessionStorage через window.open;
  нативна команда меню Duplicate, Firefox і Safari окремо не перевірялися.
  30 хвилин реального очікування не проводили: використано зазначені контрольні годинники/стан.
- Next dev-нестабільність із кроків 1–2 не ремонтувалася й не оголошується усуненою.
  Приймання виконано у локальному production-режимі. Build повідомляє про кілька
  lockfiles перевірочної копії та застарілу Browserslist-базу; збірка успішна.
- Розгортання, production retention/backup, реальні дані та кроки 4–8 лишаються поза
  задачею. Локальний build-перемикач не є перемиканням запущеного production.

Після приймання запущені для задачі Next, HTTPS helper та Compose-стенд зупинено.
Синтетичні volumes і перевірочні артефакти збережено; commit/push не виконано.
