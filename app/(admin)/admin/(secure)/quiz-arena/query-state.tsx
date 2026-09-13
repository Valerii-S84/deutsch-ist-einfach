"use client";
import Link from "next/link";
export function QueryState({ error, loading }: { error?: unknown; loading?: boolean }) {
  return <section role={error ? "alert" : "status"} className="surface space-y-3 rounded-2xl p-5">
    <p>{error ? "Не вдалося отримати або перевірити дані Quiz Arena. Значення не відображаються." : loading ? "Завантаження даних Quiz Arena…" : "Даних немає."}</p>
    {error ? <><Link className="underline" href={{ pathname: "/admin/quiz-arena/login" }}>Перевірити вхід у Quiz Arena</Link><p>Перевірте підключення backend або повторіть запит.</p><button onClick={() => window.location.reload()}>Повторити</button></> : null}
  </section>;
}
