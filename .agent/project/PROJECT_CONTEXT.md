# Контекст проєкту

profile: project

Профіль налаштовано за перевіреними локальними джерелами для deutsch-ist-einfach.
Записуй перевірені факти та джерела. Для відсутньої можливості використовуй
`не застосовується: причина`. Невідоме не видавай за встановлений факт.
Невідоме блокує залежну дію, а не всі задачі. Перевірка повної готовності вимагає усунути невідомі поля.
Ідентифікатори полів нижче стабільні для валідатора; їхні значення й пояснення українською.

## Ідентичність і структура

project_name: deutsch-ist-einfach; публічний сайт deutschmit.de
stack: Next.js 15, React 18, TypeScript, TanStack Query, PostgreSQL; джерело package.json
user_language: українська
source_paths: app/, lib/, db/, content/
test_paths: *.test.ts і *.test.tsx біля коду; vitest.config.ts
protected_paths: .env*, .git/, production; чинні правила SECURITY_RULES.md
fact_sources: package.json, Git HEAD 9c1bdb8 на початку задачі, README.md, docs/admin-restoration.md

## Команди

test_command: npm test
lint_command: npm run lint
build_command: npm run build
run_command: npm run dev

Для кожної активної команди нижче вкажи робочий каталог, потрібне середовище,
побічні ефекти та джерело. Не запускай команду лише для заповнення цього шаблону.

command_notes: Корінь репозиторію, локальний Node/npm. test — синтетичні дані; typecheck: npm run typecheck. build записує .next; dev/start можуть використовувати runtime env, не підключати реальні дані без дозволу. Команди визначено package.json.

## Залежності та дозволи

external_dependencies: PostgreSQL сайту; опційний Quiz Arena/Quiz Bank; спільні Caddy/VPS/мережа описані docs/admin-restoration.md
production_boundaries: Локальна реалізація не є дозволом deploy, міграцій, Caddy/DNS або роботи з реальними даними
approval_required: Production, реальні дані, міграції, Caddy/DNS; push/PR/merge за SECURITY_RULES.md

Вказуй лише шляхи або ролі сховищ секретів, ніколи значення.
secret_locations: .env* та runtime environment; значення не читати й не виводити

## Git

git_enabled: true
protected_branches: не встановлено; перед публікацією перевірити
commit_policy: Лише за прямим дорученням; для поточної задачі commit не доручено
commit_format: Короткий опис зміни за GIT_WORKFLOW.md
merge_strategy: не встановлено; merge не дозволено поточною задачею

Для `git_enabled` використовуй `true` або `false`; якщо Git не використовується,
залежні Git-поля познач незастосовними з причиною.

## Бюджет та середовище

agent_adapter: не застосовується: універсальний профіль; адаптер підключається за потреби
budget_unit: не застосовується: числовий бюджет не заданий
budget_limit: не застосовується: числовий бюджет не заданий
budget_measurement: не застосовується: числовий бюджет не заданий
budget_scope: не застосовується: числовий бюджет не заданий
delegation: заборонено за замовчуванням

Для числового бюджету заповни всі чотири поля: наприклад, одиницю часу, додатну межу,
доступне джерело обліку та охоплення поточної задачі разом із допоміжними процесами.
Це параметри, не вимірювання вже витрачених ресурсів.

## Необов'язкові ролі та рев'ю

role_mode: auto
review_mode: risk_based
review_triggers: не застосовується: додаткові умови окремого рев'ю не задані
review_executor: unspecified

Значення й межі визначені у [профілях](../profiles/ROLES.md). Нові поля необов'язкові:
якщо їх немає, діють наведені типові значення. `role_mode` також допускає `explicit`;
`review_mode` — `self` або `separate`; `review_executor` — `user` або `separate_agent`.
Для обов'язкового окремого рев'ю за режимом або додатковими умовами вкажи виконавця.
Призначення рев'юера не змінює поле `delegation` і не є дозволом запускати іншого агента.

## Контроль продуктів

Нормативні контракти: [метрики](../../docs/statistics-contract.md), [карта продуктів і приймання](../../docs/admin-restoration.md). Зміни адміністративних можливостей потребують доказу збереження доступу, API й постумов. Статистика та контроль власника критичні; видалення без прямого дозволу власника заборонене.
