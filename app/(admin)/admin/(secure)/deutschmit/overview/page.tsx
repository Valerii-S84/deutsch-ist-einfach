"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fetchDeutschmitOverview, fetchDeutschmitSessions } from "@/lib/deutschmit-analytics-client";
import type { AnalyticsReportDays } from "@/lib/analytics/report-contract";

import { AnalyticsMeta, DeutschmitNavigation, formatDate, formatDateTime, formatNumber, SnapshotNotice, RefreshReport, PeriodSelect, ReportState } from "../analytics-ui";

export default function DeutschmitOverviewPage() {
  const [days, setDays] = useState<AnalyticsReportDays>(7);
  const query = useQuery({
    queryKey: ["deutschmit-analytics", "overview", days],
    queryFn: () => fetchDeutschmitOverview(days),
    retry: false,
    staleTime: 0,
  });
  const data = query.data;
  const visits = useQuery({ queryKey: ["deutschmit-analytics", "recent-sessions", days], queryFn: () => fetchDeutschmitSessions({ days, page: 1 }), retry: false, staleTime: 0 });

  return (
    <main className="min-w-0 space-y-6 py-2">
      <DeutschmitNavigation active="overview" />
      <section className="surface rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ember/60">Статистика сайту</p>
            <h2 className="mt-1 text-2xl">Огляд</h2>
            <p className="mt-2 text-sm text-ember/70">Відвідувачі, сторінки та дії за вибраний період. Заявки тут враховують отримані підтвердження збереження; повний список доступний у розділі заявок.</p>
          </div>
          <PeriodSelect value={days} onChange={value => setDays(value)} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Швидкий доступ до статистики">
        {[["sessions", "Хід відвідувань", "Коли заходили, які сторінки відкривали та що натискали"], ["traffic", "Джерела переходів", "Звідки приходять відвідувачі"], ["events", "Натискання та дії", "Які кнопки й посилання використовують"]].map(([path, label, detail]) => <Link key={path} href={{ pathname: `/admin/deutschmit/${path}`, query: { days } }} className="surface rounded-xl border border-ember/20 p-4"><strong>{label}</strong><p className="mt-2 text-sm">{detail}</p></Link>)}
      </section>
      <RefreshReport refreshing={query.isFetching || visits.isFetching} onRefresh={() => { void query.refetch(); void visits.refetch(); }} />
      <ReportState loading={query.isLoading || query.isFetching} error={query.error}>
        {data ? <>
          <SnapshotNotice generatedAt={data.generated_at} />
          {!data.history_available_from ? <p className="rounded-xl border border-ember/15 bg-white/60 p-4 text-sm text-ember/70">Джерело ще не має спостережень. Це не означає, що відвідувачів не було.</p> : null}
          {data.history_available_from && Object.values(data.totals).every(value => value === 0) ? <p className="rounded-xl border border-ember/15 bg-white/60 p-4 text-sm text-ember/70">За вибраний період подій не зафіксовано.</p> : null}

          {data.history_available_from ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Відвідувачі" value={data.totals.visitors} />
            <MetricCard label="Відвідування" value={data.totals.sessions} />
            <MetricCard label="Перегляди сторінок" value={data.totals.page_views} />
            <MetricCard label="Переходи в Telegram" value={data.totals.telegram_clicks} />
            <MetricCard label="Підтверджені заявки" value={data.totals.analytics_conversions} />
          </section> : null}

          <section className="surface rounded-2xl p-4"><h2 className="text-xl">Останні відвідування</h2><ReportState loading={visits.isLoading || visits.isFetching} error={visits.error}>
            {visits.data ? <><ul className="mt-3 divide-y divide-ember/10">{visits.data.items.slice(0, 5).map(visit => <li key={visit.session_id} className="py-3"><Link className="block underline" href={{ pathname: `/admin/deutschmit/sessions/${visit.session_id}`, query: { days } }}>{formatDateTime(visit.started_at)} · {visit.first_page ?? "Сторінку не зафіксовано"} → {visit.last_page ?? "Сторінку не зафіксовано"}</Link><p className="mt-1 text-sm">Перегляди: {visit.page_views} · Переходи в Telegram: {visit.telegram_clicks} · Заявки: {visit.analytics_conversions} · Завершені вікторини: {visit.quiz_completions}</p></li>)}</ul>{visits.data.items.length === 0 ? <p className="mt-3 text-sm">За вибраний період відвідувань не зафіксовано.</p> : null}<Link className="mt-3 inline-block underline" href={{ pathname: "/admin/deutschmit/sessions", query: { days } }}>Усі відвідування та їхні дії</Link></> : null}
          </ReportState></section>
          <section className="surface rounded-2xl p-4">
            <h2 className="text-xl">Активність за днями</h2>
            <p className="mt-1 text-sm text-ember/65">Усі {data.daily_series.length} днів вибраного періоду. Відвідувачів і відвідування пораховано окремо для кожного дня.</p>
            <div className="mt-4 h-72 w-full" aria-label="Відвідування за днями">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily_series} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(32,22,15,.12)" />
                  <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={24} />
                  <YAxis allowDecimals={false} />
                  <Tooltip labelFormatter={value => formatDate(String(value))} formatter={(value: number, name: string) => [formatNumber(value), name]} />
                  <Legend />
                  <Line type="monotone" dataKey="visitors" name="Відвідувачі" stroke="#b54a28" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sessions" name="Відвідування" stroke="#236b68" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="page_views" name="Перегляди" stroke="#6b4c9a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-ember/50"><tr><th className="py-2 pr-3">Дата UTC</th><th className="py-2 pr-3">Відвідувачі</th><th className="py-2 pr-3">Відвідування</th><th className="py-2 pr-3">Перегляди</th><th className="py-2 pr-3">Telegram</th><th className="py-2 pr-3">Заявки</th></tr></thead>
                <tbody className="divide-y divide-ember/10">
                  {data.daily_series.map(point => <tr key={point.date}><td className="py-2 pr-3">{point.date}</td><td className="py-2 pr-3">{formatNumber(point.visitors)}</td><td className="py-2 pr-3">{formatNumber(point.sessions)}</td><td className="py-2 pr-3">{formatNumber(point.page_views)}</td><td className="py-2 pr-3">{formatNumber(point.telegram_clicks)}</td><td className="py-2 pr-3">{formatNumber(point.analytics_conversions)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </section>

          <section className="surface rounded-2xl p-4">
            <h2 className="text-xl">Найпопулярніші сторінки</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-ember/50"><tr><th className="py-2 pr-3">Адреса сторінки</th><th className="py-2 pr-3">Перегляди</th><th className="py-2 pr-3">Відвідувачі</th><th className="py-2 pr-3">Telegram</th></tr></thead>
                <tbody className="divide-y divide-ember/10">
                  {data.top_pages.map(page => <tr key={page.path}><td className="max-w-[260px] truncate py-2 pr-3" title={page.path}><Link className="underline" href={{ pathname: "/admin/deutschmit/sessions", query: { days, selection: JSON.stringify({ kind: "page", path: page.path }) } }}>{page.path}</Link></td><td className="py-2 pr-3">{formatNumber(page.page_views)}</td><td className="py-2 pr-3">{formatNumber(page.unique_visitors)}</td><td className="py-2 pr-3">{formatNumber(page.telegram_clicks)}</td></tr>)}
                  {data.top_pages.length === 0 ? <tr><td colSpan={4} className="py-3 text-ember/60">За вибраний період переглядів сторінок не зафіксовано.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>

          <AnalyticsMeta generatedAt={data.generated_at} lastReceivedAt={data.last_received_at} historyAvailableFrom={data.history_available_from} periodStart={data.period_start} days={data.days} />
        </> : null}
      </ReportState>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return <article className="surface rounded-2xl p-4"><p className="text-xs uppercase tracking-wide text-ember/60">{label}</p><p className="mt-1 text-2xl font-semibold">{formatNumber(value)}</p></article>;
}
