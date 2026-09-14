import Link from "next/link";
import { readShortsStatistics } from "@/lib/server/shorts-statistics";

export const dynamic = "force-dynamic";
const pages: Record<string, string> = { "/": "Головна", "/privacy/": "Конфіденційність", "/support/": "Підтримка", "/terms/": "Умови користування" };
const elements: Record<string, string> = { home: "На головну", privacy: "Конфіденційність", support: "Підтримка", terms: "Умови користування", email: "Написати на пошту", preview_primary: "Основна кнопка демонстрації", preview_secondary: "Додаткова кнопка демонстрації", preview_button: "Кнопка демонстрації" };
const names = { page_view: "Перегляд сторінки", element_click: "Натискання", page_leave: "Підсумок активного часу" };
const date = (value: string) => new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Berlin" }).format(new Date(value));

export default async function ShortsStatistics({ searchParams }: { searchParams: Promise<{ days?: string; page?: string; session?: string }> }) {
  const params = await searchParams;
  const days = [7, 30, 90].includes(Number(params.days)) ? Number(params.days) : 7;
  const page = /^\d{1,5}$/.test(params.page ?? "") && Number(params.page) > 0 ? Number(params.page) : 1;
  const session = /^[0-9a-f-]{36}$/i.test(params.session ?? "") ? params.session : undefined;
  const report = await readShortsStatistics(days, page, session).catch(() => null);
  return <main className="space-y-6">
    <header className="surface space-y-3 rounded-2xl p-6">
      <h1 className="text-3xl">Статистика Shorts Blocker Kids</h1><p>www.shortsblockerkids.de</p>
      <nav aria-label="Період статистики" className="flex gap-3">{[7, 30, 90].map(value => <Link key={value} href={`?days=${value}`} aria-current={days === value ? "page" : undefined} className={`rounded-lg border px-4 py-2 ${days === value ? "bg-slate-900 text-white" : "bg-white"}`}>{value} днів</Link>)}</nav>
    </header>
    {!report ? <section role="alert" className="surface rounded-2xl p-6"><h2 className="text-xl">Джерело статистики недоступне</h2><p>Не вдалося отримати підтверджені дані. Це не означає нульову активність.</p></section> : <>
      <section className="surface space-y-2 rounded-2xl p-6">
        <p>Звіт сформовано: {date(report.generated_at)}. Час відображено за Берліном.</p>
        <p>Початок наявної історії: {report.history_available_from ? date(report.history_available_from) : "подій ще немає"}.</p>
        <p>Остання отримана подія: {report.last_received_at ? date(report.last_received_at) : "подій ще немає"}. Обрано останні {days} × 24 години.</p>
      </section>
      <section aria-label="Показники" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {([["Відвідувачі (браузери)", report.totals.visitors], ["Відвідування", report.totals.sessions], ["Перегляди сторінок", report.totals.page_views], ["Натискання", report.totals.clicks]] as const).map(([label, value]) => <article key={label} className="surface rounded-2xl p-6"><h2>{label}</h2><p className="text-4xl">{value}</p></article>)}
      </section>
      <section className="surface space-y-3 rounded-2xl p-6"><h2 className="text-xl">Які сторінки переглядали</h2>
        <table className="w-full text-left"><thead><tr><th>Сторінка</th><th>Перегляди</th><th>Натискання</th></tr></thead><tbody>{report.pages.map(row => <tr key={row.path}><td className="py-2">{pages[row.path]}</td><td>{row.views}</td><td>{row.clicks}</td></tr>)}</tbody></table>
      </section>
      <section className="surface space-y-3 rounded-2xl p-6"><h2 className="text-xl">Що натискали</h2>
        {report.elements.length ? <table className="w-full text-left"><thead><tr><th>Дія</th><th>Кількість</th></tr></thead><tbody>{report.elements.map(row => <tr key={row.element_id}><td className="py-2">{elements[row.element_id]}</td><td>{row.clicks}</td></tr>)}</tbody></table> : <p>За цей період натискань не зафіксовано.</p>}
      </section>
      <section className="surface space-y-3 rounded-2xl p-6"><h2 className="text-xl">Звідки переходили</h2><p>До 100 джерел із найбільшою кількістю відвідувань.</p>
        <table className="w-full text-left"><thead><tr><th>Джерело</th><th>Відвідування</th></tr></thead><tbody>{report.sources.map(row => <tr key={row.host ?? "direct"}><td className="py-2">{row.host ?? "Прямий перехід або джерело невідоме"}</td><td>{row.sessions}</td></tr>)}</tbody></table>
      </section>
      <section className="surface space-y-3 overflow-x-auto rounded-2xl p-6"><h2 className="text-xl">Хто заходив і що робив</h2><p>Анонімні відвідування. Відкрийте запис, щоб побачити послідовність дій.</p>
        <table className="w-full text-left"><thead><tr><th>Початок</th><th>Відвідувач</th><th>Перегляди</th><th>Натискання</th><th>Деталі</th></tr></thead><tbody>{report.sessions.map(row => <tr key={row.session_id}><td className="py-2">{date(row.first_at)}</td><td>{row.visitor_id.slice(0, 8)}</td><td>{row.views}</td><td>{row.clicks}</td><td><Link className="underline" href={`?days=${days}&page=${page}&session=${row.session_id}#visit`}>Дії відвідувача</Link></td></tr>)}</tbody></table>
        <nav aria-label="Сторінки відвідувань" className="flex gap-4">{page > 1 && <Link href={`?days=${days}&page=${page - 1}`}>Попередні</Link>}{page * 50 < report.totals.sessions && <Link href={`?days=${days}&page=${page + 1}`}>Наступні</Link>}</nav>
      </section>
      {session && <section id="visit" className="surface space-y-3 rounded-2xl p-6"><h2 className="text-xl">Послідовність дій відвідування</h2>
        {!report.events.length && <p>У вибраному періоді подій цього відвідування немає.</p>}
        {report.events_truncated && <p>Показано перші 1000 подій цього відвідування.</p>}
        <ol className="space-y-3">{report.events.map(event => <li key={event.event_id}><time>{date(event.occurred_at)}</time> · {names[event.event_name]} · {pages[event.path]}{event.element_id ? ` · ${elements[event.element_id]}` : ""}{event.active_ms !== null ? ` · ${Math.round(event.active_ms / 1000)} с активного часу на сторінці (накопичено)` : ""}</li>)}</ol>
      </section>}
    </>}
    <section className="surface space-y-2 rounded-2xl p-6"><h2 className="text-xl">Як рахуються показники</h2>
      <p>Відвідувач — випадкова позначка браузера на 90 днів. Відвідування поновлюється після 30 хвилин перерви. Імена, IP-адреси, тексти форм і параметри посилань не збираються.</p>
      <p>Записуються покази сторінок і натискання на наявні посилання та кнопки. Кнопки демонстрації не означають покупку чи встановлення застосунку. Активний час — оцінка з урахуванням видимості, фокуса та хвилини бездіяльності.</p>
      <p>Тестові події виключені. Блокувальник, відключений JavaScript, сигнали приватності або збій мережі можуть перешкоджати доставці подій. Історія до підключення збору не відновлюється.</p>
    </section>
  </main>;
}
