"use client";
export default function QuizArenaError({ reset }: { reset: () => void }) {
  return <section role="alert" className="surface space-y-4 rounded-2xl p-6">
    <h1>Не вдалося відобразити дані Quiz Arena</h1>
    <p>Статистика цього розділу недоступна. Інші продукти можна відкрити в головному меню.</p>
    <button onClick={reset}>Повторити</button>
  </section>;
}
