# Стиль проєкту

Заповнюй лише правила реальних мов і каталогів цього репо. Не дублюй універсальні принципи.
У репозиторії без коду використовуй `не застосовується: причина`.

active_languages: TypeScript/TSX, SQL, JavaScript scripts; Python лише ізольована перевірка backend pure-функцій
style_sources: Наявні app/, lib/, eslint.config.mjs, tsconfig.json
formatters_linters: ESLint next/core-web-vitals; npm run typecheck
test_conventions: Vitest тести біля коду; Node environment для server routes; синтетичні дані та mocks без production
migration_conventions: db/migrations/*.sql; поточна задача не дозволяє виконувати міграції
numeric_limits: не застосовується: універсальні числові межі не нав'язуються

Нижче за потреби додай тільки активні секції: мова, область шляхів, наявні домовленості,
джерело, винятки. Не створюй секції для всіх можливих мов.
Локальна домовленість про стиль не дозволяє змінювати несуміжний код.
