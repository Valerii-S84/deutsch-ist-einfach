"use client";

import { analyticsLabel } from "@/lib/admin-analytics-labels";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { parseReportSelection, type ReportSelection } from "@/lib/analytics/report-selection";
import { isAnalyticsReportDays } from "@/lib/analytics/report-contract";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { EVENT_NAMES } from "@/lib/analytics/contract";
import type { AnalyticsReportDays, AnalyticsSessions } from "@/lib/analytics/report-contract";
import { fetchDeutschmitSessions } from "@/lib/deutschmit-analytics-client";

import { AnalyticsMeta, DeutschmitNavigation, formatDuration, formatNumber, formatDateTime, SnapshotNotice, RefreshReport, PeriodSelect, ReportState, sessionStatus } from "../analytics-ui";

export default function DeutschmitSessionsPage() {
  return <Suspense fallback={<p role="status">Завантаження…</p>}><SessionsFromUrl /></Suspense>;
}

function SessionsFromUrl() {
  const params = useSearchParams();
  const days = Number(params.get("days") ?? 7);
  const selection = parseReportSelection(params.get("selection"));
  if (!isAnalyticsReportDays(days) || selection === false) return <p role="alert">Некоректний фільтр звіту.</p>;
  return <SessionsReport key={params.toString()} initialDays={days} initialSelection={selection} />;
}

function SessionsReport({ initialDays, initialSelection }: { initialDays: AnalyticsReportDays; initialSelection?: ReportSelection }) {
  const [days, setDays] = useState<AnalyticsReportDays>(initialDays);
  const [selection, setSelection] = useState(initialSelection);
  const [page, setPage] = useState(1);
  const [path, setPath] = useState<string | undefined>();
  const [pathDraft, setPathDraft] = useState("");
  const [eventName, setEventName] = useState<AnalyticsSessions["filters"]["event_name"]>(null);
  const query = useQuery({
    queryKey: ["deutschmit-analytics", "sessions", days, page, path, eventName, selection],
    queryFn: () => fetchDeutschmitSessions({ days, page, path, eventName, selection }),
    placeholderData: () => undefined,
    retry: false,
    staleTime: 0,
  });
  const data = query.data;

  function submitPath(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setPath(pathDraft.trim() || undefined);
  }

  function changeDays(value: AnalyticsReportDays) {
    setDays(value);
    setPage(1);
  }

  function changeEvent(value: string) {
    setEventName((value || null) as AnalyticsSessions["filters"]["event_name"]);
    setPage(1);
  }

  return (
    <main className="min-w-0 space-y-6 py-2">
      <DeutschmitNavigation active="sessions" />
      <section className="surface rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs uppercase tracking-[0.2em] text-ember/60">Статистика сайту</p><h2 className="mt-1 text-2xl">Відвідування</h2><p className="mt-2 text-sm text-ember/70">Кожен рядок — відвідування в окремій вкладці з дією за вибраний період. Відкрийте його, щоб побачити сторінки й усі зафіксовані дії у часі. До 50 відвідувань на сторінці.</p></div>
          <PeriodSelect value={days} onChange={changeDays} />
        </div>
        <form onSubmit={submitPath} className="mt-5 flex flex-wrap items-end gap-3" aria-label="Фільтри відвідувань">
          {selection ? <p className="w-full break-words text-sm">Фільтр звіту: {Object.entries(selection).map(([key, value]) => `${analyticsLabel(key)}: ${value === null ? '—' : analyticsLabel(String(value))}`).join(' · ')} <button type="button" className="underline" onClick={() => { setSelection(undefined); setPage(1); }}>Прибрати фільтр звіту</button></p> : null}
          <label className="text-sm">Сторінка<input value={pathDraft} onChange={event => setPathDraft(event.target.value)} placeholder="/contact" className="mt-1 block rounded-xl border border-ember/20 bg-white px-3 py-2" /></label>
          <label className="text-sm">Тип дії<select aria-label="Тип дії" value={eventName ?? ""} onChange={event => changeEvent(event.target.value)} className="mt-1 block rounded-xl border border-ember/20 bg-white px-3 py-2"><option value="">Усі дії</option>{EVENT_NAMES.map(name => <option key={name} value={name}>{analyticsLabel(name)}</option>)}</select></label>
          <button type="submit" className="rounded-xl bg-ember px-3 py-2 text-sand">Застосувати</button>
          {path || eventName ? <button type="button" className="rounded-xl border border-ember/20 px-3 py-2" onClick={() => { setPathDraft(""); setPath(undefined); setEventName(null); setPage(1); }}>Скинути</button> : null}
        </form>
      </section>

      <RefreshReport refreshing={query.isFetching} onRefresh={() => void query.refetch()} />
      <ReportState loading={query.isLoading || query.isFetching} error={query.error}>
        {data ? <>
          <SnapshotNotice generatedAt={data.generated_at} />
          {!data.history_available_from ? <p className="rounded-xl border border-ember/15 bg-white/60 p-4 text-sm text-ember/70">Джерело ще не має спостережень. Це не означає, що відвідувачів не було.</p> : null}
          <section className="surface rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl">Відвідування: {formatNumber(data.total)}</h2><p className="text-sm text-ember/65">Сторінка {data.page} із {data.pages}</p></div>
            {data.items.length === 0 ? <p className="mt-4 text-sm text-ember/65">За вибраним періодом і фільтрами відвідувань не знайдено.</p> : <div className="mt-3 overflow-x-auto"><table className="min-w-[900px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-ember/50"><tr><th className="py-2 pr-3">Початок / остання дія</th><th className="py-2 pr-3">Сторінки</th><th className="py-2 pr-3">Джерело</th><th className="py-2 pr-3">Перегляди</th><th className="py-2 pr-3">Оцінка активного часу</th><th className="py-2 pr-3">Результат</th><th className="py-2 pr-3">Дії у часі</th></tr></thead><tbody className="divide-y divide-ember/10">{data.items.map(item => <SessionRow key={item.session_id} item={item} days={data.days} />)}</tbody></table></div>}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm"><button className="rounded-lg border border-ember/20 px-3 py-2 disabled:opacity-40" disabled={data.page <= 1} onClick={() => setPage(current => current - 1)}>Назад</button><span>{data.page} / {data.pages}</span><button className="rounded-lg border border-ember/20 px-3 py-2 disabled:opacity-40" disabled={data.page >= data.pages} onClick={() => setPage(current => current + 1)}>Далі</button></div>
          </section>
          <AnalyticsMeta generatedAt={data.generated_at} lastReceivedAt={data.last_received_at} historyAvailableFrom={data.history_available_from} periodStart={data.period_start} days={data.days} />
        </> : null}
      </ReportState>
    </main>
  );
}

function SessionRow({ item, days }: { item: AnalyticsSessions["items"][number]; days: AnalyticsReportDays }) {
  const result = item.outcome === "conversion" ? `Заявка (${item.analytics_conversions})` : item.outcome === "quiz_completed" ? `Вікторина (${item.quiz_completions})` : item.outcome === "telegram_click" ? `Telegram (${item.telegram_clicks})` : "Цільових дій не зафіксовано";
  return <tr><td className="py-3 pr-3"><div>{formatDateTime(item.started_at)}</div><div className="mt-1 text-xs text-ember/60">{item.last_activity_at ? formatDateTime(item.last_activity_at) : "Немає даних"}</div><div className="mt-1 text-xs">{sessionStatus(item.status)}{item.incomplete ? " · Неповні спостереження" : ""}</div></td><td className="py-3 pr-3"><div>{item.first_page ?? "сторінку не зафіксовано"}</div><div className="mt-1 text-xs text-ember/60">→ {item.last_page ?? "сторінку не зафіксовано"}</div></td><td className="py-3 pr-3 max-w-[180px] truncate" title={item.entry_source}>{analyticsLabel(item.entry_source)}</td><td className="py-3 pr-3">{formatNumber(item.page_views)}</td><td className="py-3 pr-3">{formatDuration(item.active_ms)}</td><td className="py-3 pr-3">{result}</td><td className="py-3 pr-3"><Link className="underline" href={`/admin/deutschmit/sessions/${encodeURIComponent(item.session_id)}?days=${days}`}>Відкрити</Link></td></tr>;
}
