# Контрольні приклади відповідей

У `statistics-fixtures/` збережено `public-stats-seeded.json` та чотири відновлені історичні overview DTO: empty-7d, seeded-7d/30d/90d. Джерело — Git `36d8b1d`; демографічні масиви явно позначені порожніми там, де історичний DTO їх не містив. Це синтетичні агрегати, а не вивантаження production.

Значення карток і правила застосування наведено в [контрактах метрик](statistics-contract.md). Автоматична звірка — `lib/quiz-arena-verification.test.ts`, `lib/quiz-arena-statistics.test.ts` і тести нормалізації dashboard.

Приклади не містять сирих користувачів/покупок, тому не доводять коректність backend-фільтрів, retention, distinct, часових меж або прав доступу. Для цього потрібен окремий контрольний seed backend.
