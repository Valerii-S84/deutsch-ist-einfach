"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fetchDeutschmitOverview } from "@/lib/deutschmit-analytics-client";
import type { AnalyticsReportDays } from "@/lib/analytics/report-contract";

import { AnalyticsMeta, DeutschmitNavigation, formatDate, formatNumber, SnapshotNotice, RefreshReport, PeriodSelect, ReportState } from "../analytics-ui";

export default function DeutschmitOverviewPage() {
  const [days, setDays] = useState<AnalyticsReportDays>(7);
  const query = useQuery({
    queryKey: ["deutschmit-analytics", "overview", days],
    queryFn: () => fetchDeutschmitOverview(days),
    retry: false,
    staleTime: 0,
  });
  const data = query.data;

  return (
    <main className="min-w-0 space-y-6 py-2">
      <DeutschmitNavigation active="overview" />
      <section className="surface rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ember/60">Website Analytics v2</p>
            <h2 className="mt-1 text-2xl">Overview</h2>
            <p className="mt-2 text-sm text-ember/70">Beobachtete Aktivität nach Einwilligung. Übertragungsverluste sind möglich; Analytics-Anträge zählen nur zugestellte Server-Bestätigungen.</p>
          </div>
          <PeriodSelect value={days} onChange={value => setDays(value)} />
        </div>
      </section>

      <RefreshReport refreshing={query.isFetching} onRefresh={() => void query.refetch()} />
      <ReportState loading={query.isLoading} error={query.error}>
        {data ? <>
          <SnapshotNotice generatedAt={data.generated_at} />
          {!data.history_available_from ? <p className="rounded-xl border border-ember/15 bg-white/60 p-4 text-sm text-ember/70">Es liegen noch keine Beobachtungen vor. Das ist kein gemessener Null-Traffic.</p> : null}
          {data.history_available_from && Object.values(data.totals).every(value => value === 0) ? <p className="rounded-xl border border-ember/15 bg-white/60 p-4 text-sm text-ember/70">Im ausgewählten Zeitraum wurden keine Beobachtungen gespeichert.</p> : null}

          {data.history_available_from ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Besucher" value={data.totals.visitors} />
            <MetricCard label="Sitzungen" value={data.totals.sessions} />
            <MetricCard label="Seitenaufrufe" value={data.totals.page_views} />
            <MetricCard label="Telegram-Klicks" value={data.totals.telegram_clicks} />
            <MetricCard label="Analytics-Anträge" value={data.totals.analytics_conversions} />
          </section> : null}

          <section className="surface rounded-2xl p-4">
            <h2 className="text-xl">Tagesverlauf</h2>
            <p className="mt-1 text-sm text-ember/65">Alle {data.daily_series.length} Tage des ausgewählten Zeitraums; Besucher und Sitzungen sind jeweils distinct.</p>
            <div className="mt-4 h-72 w-full" aria-label="Tagesverlauf der Website Analytics">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily_series} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(32,22,15,.12)" />
                  <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={24} />
                  <YAxis allowDecimals={false} />
                  <Tooltip labelFormatter={value => formatDate(String(value))} formatter={(value: number, name: string) => [formatNumber(value), name]} />
                  <Legend />
                  <Line type="monotone" dataKey="visitors" name="Besucher" stroke="#b54a28" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sessions" name="Sitzungen" stroke="#236b68" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="page_views" name="Views" stroke="#6b4c9a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-ember/50"><tr><th className="py-2 pr-3">Tag UTC</th><th className="py-2 pr-3">Besucher</th><th className="py-2 pr-3">Sitzungen</th><th className="py-2 pr-3">Views</th><th className="py-2 pr-3">Telegram</th><th className="py-2 pr-3">Anträge</th></tr></thead>
                <tbody className="divide-y divide-ember/10">
                  {data.daily_series.map(point => <tr key={point.date}><td className="py-2 pr-3">{point.date}</td><td className="py-2 pr-3">{formatNumber(point.visitors)}</td><td className="py-2 pr-3">{formatNumber(point.sessions)}</td><td className="py-2 pr-3">{formatNumber(point.page_views)}</td><td className="py-2 pr-3">{formatNumber(point.telegram_clicks)}</td><td className="py-2 pr-3">{formatNumber(point.analytics_conversions)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </section>

          <section className="surface rounded-2xl p-4">
            <h2 className="text-xl">Top Pages</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-ember/50"><tr><th className="py-2 pr-3">Pfad</th><th className="py-2 pr-3">Views</th><th className="py-2 pr-3">Besucher</th><th className="py-2 pr-3">Telegram</th></tr></thead>
                <tbody className="divide-y divide-ember/10">
                  {data.top_pages.map(page => <tr key={page.path}><td className="max-w-[260px] truncate py-2 pr-3" title={page.path}>{page.path}</td><td className="py-2 pr-3">{formatNumber(page.page_views)}</td><td className="py-2 pr-3">{formatNumber(page.unique_visitors)}</td><td className="py-2 pr-3">{formatNumber(page.telegram_clicks)}</td></tr>)}
                  {data.top_pages.length === 0 ? <tr><td colSpan={4} className="py-3 text-ember/60">Keine Seitenbeobachtungen im Zeitraum.</td></tr> : null}
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
