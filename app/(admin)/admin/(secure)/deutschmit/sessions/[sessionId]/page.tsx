"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import type { AnalyticsReportDays, AnalyticsSessionEvent } from "@/lib/analytics/report-contract";
import { fetchDeutschmitSession } from "@/lib/deutschmit-analytics-client";

import { AnalyticsMeta, DeutschmitNavigation, formatDateTime, formatDuration, SnapshotNotice, RefreshReport, PeriodSelect, ReportState, sessionStatus } from "../../analytics-ui";

export default function DeutschmitSessionDetailPage() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const days = parseDays(searchParams.get("days"));
  const query = useQuery({
    queryKey: ["deutschmit-analytics", "session", sessionId, days],
    queryFn: () => fetchDeutschmitSession(sessionId),
    enabled: Boolean(sessionId),
    retry: false,
    staleTime: 0,
  });
  const data = query.data;
  const periodStart = useMemo(() => data ? periodStartFor(data.generated_at, days) : null, [data, days]);

  return <main className="min-w-0 space-y-6 py-2">
    <DeutschmitNavigation active="sessions" />
    <section className="surface rounded-2xl p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.2em] text-ember/60">Session Explorer</p><h2 className="mt-1 break-all text-2xl">{sessionId}</h2><p className="mt-2 text-sm text-ember/70">Die vollständige gespeicherte Sitzung; Ereignisse außerhalb des ausgewählten Zeitraums sind markiert.</p></div><div className="flex items-center gap-2"><label className="text-sm">Zeitraum<PeriodSelect value={days} onChange={value => { router.replace(`?days=${value}`); }} /></label><Link className="rounded-xl border border-ember/20 px-3 py-2 text-sm" href="/admin/deutschmit/sessions">Zurück zu Sessions</Link></div></div></section>
    <RefreshReport refreshing={query.isFetching} onRefresh={() => void query.refetch()} />
      <ReportState loading={query.isLoading} error={query.error}>
      {data && periodStart ? <>
        <SnapshotNotice generatedAt={data.generated_at} />
        {!data.history_available_from ? <p className="rounded-xl border border-ember/15 bg-white/60 p-4 text-sm text-ember/70">Es liegen noch keine Analytics-Beobachtungen vor.</p> : null}
        {data.summary ? <section className="surface space-y-2 rounded-2xl p-4">
          <h2 className="text-xl">Tab-Sitzung · {sessionStatus(data.summary.status)}</h2>
          <p>{data.summary.first_page} → {data.summary.last_page} · Quelle: {data.summary.entry_source}</p>
          <p>Start: {formatDateTime(data.summary.started_at)} · Letzte Aktivität: {data.summary.last_activity_at ? formatDateTime(data.summary.last_activity_at) : "Keine Daten"}</p>
          <p>{data.summary.page_views} Views · Geschätzte aktive Zeit: {formatDuration(data.summary.active_ms)}</p>
          <p>Telegram: {data.summary.telegram_clicks} · Bestätigte Analytics-Anträge: {data.summary.analytics_conversions} · Quiz abgeschlossen: {data.summary.quiz_completions}</p>
          {data.summary.incomplete ? <p className="text-amber-900">Unvollständige Beobachtungen: Sitzungsstart oder Sequenz fehlt; frühere Ereignisse können nicht rekonstruiert werden.</p> : null}
        </section> : null}
        <section className="surface rounded-2xl p-4"><h2 className="text-xl">Chronologische Timeline</h2><div className="mt-4 space-y-3">{data.events.map(event => <TimelineEvent key={`${event.event_id}-${event.received_at}`} event={event} periodStart={periodStart} generatedAt={data.generated_at} />)}{data.events.length === 0 ? <p className="text-sm text-ember/65">Diese Sitzung enthält keine gespeicherten Events.</p> : null}</div></section>
        <AnalyticsMeta generatedAt={data.generated_at} lastReceivedAt={data.last_received_at} historyAvailableFrom={data.history_available_from} periodStart={periodStart.toISOString()} days={days} />
      </> : null}
    </ReportState>
  </main>;
}

function TimelineEvent({ event, periodStart, generatedAt }: { event: AnalyticsSessionEvent; periodStart: Date; generatedAt: string }) {
  const occurredAt = Date.parse(event.occurred_at);
  const outside = occurredAt < periodStart.getTime() || occurredAt >= Date.parse(generatedAt);
  return <article className={`rounded-xl border p-3 ${outside ? "border-amber-300 bg-amber-50/70" : "border-ember/15 bg-white/60"}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{eventLabel(event)}</p><p className="mt-1 text-xs text-ember/65">{formatDateTime(event.occurred_at)} · {event.path} · {event.source === "server" ? "server" : "browser"}</p></div>{outside ? <span className="rounded-full border border-amber-400 px-2 py-1 text-xs text-amber-900">Außerhalb des Zeitraums</span> : null}</div>
    {event.event_name.startsWith("form_") ? <dl className="mt-2 break-all text-xs text-ember/65">
      {(["form_id", "submission_attempt_id", "conversion_id", "error_code"] as const).map(key => typeof event.metadata[key] === "string" ? <div key={key}><dt className="inline font-semibold">{key}: </dt><dd className="inline">{String(event.metadata[key])}</dd></div> : null)}
    </dl> : null}
  </article>;
}

function eventLabel(event: AnalyticsSessionEvent): string {
  const metadata = event.metadata;
  if (event.event_name === "session_start") return "Sitzung gestartet";
  if (event.event_name === "page_view") return "Seite geöffnet";
  if (event.event_name === "form_open") return "Formular geöffnet";
  if (event.event_name === "form_submit") return "Formular abgesendet";
  if (event.event_name === "form_error") return "Formularfehler";
  if (event.event_name === "element_click") return `Klick: ${stringValue(metadata.destination) ?? "other"} · ${stringValue(metadata.element_id) ?? "element"}`;
  if (event.event_name === "element_impression") return `Impression: ${stringValue(metadata.element_id) ?? "element"}`;
  if (event.event_name === "scroll_depth") return `Scroll: ${numberValue(metadata.threshold) ?? "unbekannt"}%`;
  if (event.event_name === "engagement") return `Aktive Zeit: ${formatDuration(numberValue(metadata.active_ms))}`;
  if (event.event_name === "page_leave") return `Seite verlassen · aktiv ${formatDuration(numberValue(metadata.active_ms))} · scroll ${numberValue(metadata.scroll_percent) ?? "unbekannt"}%`;
  if (event.event_name === "article_read") return "Artikel: Read-Signal";
  if (event.event_name === "form_success") return "Formular: bestätigter Analytics-Antrag";
  if (event.event_name === "quiz_completed") return "Website Quiz: abgeschlossen";
  if (event.event_name === "quiz_started") return "Website Quiz: gestartet";
  return event.event_name.replaceAll("_", " ");
}

function stringValue(value: unknown): string | null { return typeof value === "string" ? value : null; }
function numberValue(value: unknown): number | null { return typeof value === "number" ? value : null; }
function parseDays(value: string | null): AnalyticsReportDays { const days = Number(value ?? 7); return days === 30 || days === 90 ? days : 7; }
function periodStartFor(generatedAt: string, days: AnalyticsReportDays): Date { const date = new Date(generatedAt); return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - (days - 1) * 86_400_000); }
