"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ApplicationReportName, ApplicationReport, AnalyticsPages, AnalyticsEvents, AnalyticsTraffic, AnalyticsConversions } from "@/lib/analytics/application-report-contract";
import type { ReportSelection } from "@/lib/analytics/report-selection";
import type { AnalyticsReportDays } from "@/lib/analytics/report-contract";
import { fetchDeutschmitReport } from "@/lib/deutschmit-analytics-client";
import { AnalyticsMeta, DeutschmitNavigation, formatDuration, formatNumber, PeriodSelect, RefreshReport, ReportState, SnapshotNotice } from "./analytics-ui";

const titles = { pages: "Pages", events: "Clicks/Events", traffic: "Traffic", conversions: "Conversions" };
const descriptions = {
  pages: "Views und Visitors: eindeutige Page Views bzw. Browser-IDs je Seite im UTC-Zeitraum. Aktive Zeit: Maximum je begonnenem View, Mittelwert nur mit Messung; spätere Messungen können den Wert ergänzen. Scroll: höchster beobachteter Wert. Article Read ist eine deduplizierte Leseindikation, kein Nachweis.",
  events: "Semantisch deduplizierte Events; echte wiederholte Klicks zählen einzeln. CTR: Page Views mit Impression und anschließendem Klick / Page Views mit Impression, im selben Zeitraum für dasselbe Element und Placement. Klicks ohne vorherigen passenden Eindruck stehen separat.",
  traffic: "Tab-Sitzungen mit mindestens einem Event im UTC-Zeitraum, nach gespeichertem Entry-Referrer und UTM. Interne Navigation ändert die Quelle nicht. Anteil: Sitzungen mit serverseitigem Form Success / beobachtete Sitzungen derselben Gruppe. Direct und unknown sind getrennt.",
  conversions: "Form Open, Submit und Error zählen Events; Success zählt eindeutige serverseitige Conversion-IDs nach Speicherung einer Anfrage. Website Quiz zählt eindeutige Runs. Externe Klicks sind getrennte Absichten, keine Bestätigung eines Kaufs, Abonnements oder Downloads. Totals bilden keine strikte Funnel-Kohorte.",
};

export function sessionsHref(days: AnalyticsReportDays, selection: ReportSelection) {
  return `/admin/deutschmit/sessions?${new URLSearchParams({ days: String(days), selection: JSON.stringify(selection) })}`;
}
function SessionsLink({ days, selection, children = "Sessions" }: { days: AnalyticsReportDays; selection: ReportSelection; children?: ReactNode }) {
  return <Link className="underline underline-offset-2" href={{ pathname: "/admin/deutschmit/sessions", query: { days, selection: JSON.stringify(selection) } }}>{children}</Link>;
}
export function reportRatio(numerator: number, denominator: number) {
  return `${formatNumber(numerator)} / ${formatNumber(denominator)} · ${denominator ? `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(100 * numerator / denominator)} %` : "Nicht definiert"}`;
}
function Table({ title, headers, rows }: { title: string; headers: string[]; rows: { key: string; cells: ReactNode[] }[] }) {
  return <section className="surface min-w-0 rounded-2xl p-5"><h2 className="text-xl">{title}</h2>{rows.length ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{headers.map(header => <th scope="col" key={header} className="whitespace-nowrap py-2 pr-5 text-xs text-ember/65">{header}</th>)}</tr></thead><tbody className="divide-y divide-ember/10">{rows.map(row => <tr key={row.key}>{row.cells.map((cell, index) => <td key={index} className="py-3 pr-5 align-top break-words">{cell}</td>)}</tr>)}</tbody></table></div> : <p className="mt-4 text-sm">Im ausgewählten Zeitraum wurden keine passenden Ereignisse beobachtet.</p>}</section>;
}

export function ApplicationReportPage({ name }: { name: ApplicationReportName }) {
  const [days, setDays] = useState<AnalyticsReportDays>(7);
  const query = useQuery({ queryKey: ["deutschmit-analytics", name, days], queryFn: () => fetchDeutschmitReport(name, days), retry: false, staleTime: 0, placeholderData: () => undefined });
  const data = query.data;
  return <main className="min-w-0 space-y-6 py-2">
    <DeutschmitNavigation active={name} />
    <section className="surface rounded-2xl p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl">{titles[name]}</h2><PeriodSelect value={days} onChange={setDays} /></div><p className="mt-3 text-sm text-ember/75">{descriptions[name]}</p><p className="mt-3 text-xs text-ember/65">Nur beobachtete Aktionen nach Einwilligung. Browser-IDs sind keine Personen. Blocker, Zustellverluste und begrenzte Historie können Lücken verursachen.</p></section>
    <RefreshReport refreshing={query.isFetching} onRefresh={() => void query.refetch()} />
    <ReportState loading={query.isLoading || query.isFetching} error={query.error}>
      {data && data.days === days ? <><SnapshotNotice generatedAt={data.generated_at} />
        {data.history_available_from ? <ReportTables name={name} data={data} /> : <p className="surface rounded-2xl p-5">Es liegen noch keine Beobachtungen vor. Das ist kein gemessener Null-Traffic.</p>}
        <AnalyticsMeta generatedAt={data.generated_at} lastReceivedAt={data.last_received_at} historyAvailableFrom={data.history_available_from} periodStart={data.period_start} days={data.days} />
      </> : null}
    </ReportState>
  </main>;
}

export function ReportTables({ name, data }: { name: ApplicationReportName; data: ApplicationReport }) {
  const days = data.days;
  if (name === "pages") return <Table title="Seiten" headers={["Seite", "Views", "Visitors", "Ø geschätzte aktive Zeit", "Gemessene Views", "Max. Scroll", "Leseindikationen", "Sitzungen"]} rows={(data as AnalyticsPages).items.map(row => ({ key: row.path, cells: [row.path, formatNumber(row.page_views), formatNumber(row.visitors), formatDuration(row.average_active_ms), formatNumber(row.measured_views), row.max_scroll === null ? "Keine Daten" : `${row.max_scroll} %`, formatNumber(row.article_reads), <SessionsLink key="sessions" days={days} selection={{ kind: "page", path: row.path }} />] }))} />;
  if (name === "events") {
    const report = data as AnalyticsEvents;
    return <>
      <Table title="Events nach Typ" headers={["Event", "Anzahl", "Sitzungen"]} rows={report.events.map(row => ({ key: row.event_name, cells: [row.event_name, formatNumber(row.count), <SessionsLink key="sessions" days={days} selection={{ kind: "event", event_name: row.event_name }} />] }))} />
      <Table title="Elemente" headers={["Element ID", "Placement", "Impression-Views", "Klicks", "CTR (Views)", "Klicks ohne vorherige Impression", "Sitzungen"]} rows={report.elements.map(row => ({ key: JSON.stringify([row.element_id, row.placement]), cells: [row.element_id, row.placement, formatNumber(row.impressions), formatNumber(row.clicks), reportRatio(row.matched_click_views, row.impressions), formatNumber(row.unmatched_clicks), <SessionsLink key="sessions" days={days} selection={{ kind: "element", element_id: row.element_id, placement: row.placement }} />] }))} />
      <Table title="Frontend-Fehlercodes" headers={["Code", "Komponente", "Anzahl", "Sitzungen"]} rows={report.errors.map(row => ({ key: `${row.error_code}/${row.component_id}`, cells: [row.error_code, row.component_id, formatNumber(row.count), <SessionsLink key="sessions" days={days} selection={{ kind: "error", error_code: row.error_code, component_id: row.component_id }} />] }))} />
    </>;
  }
  if (name === "traffic") return <Table title="Entry-Quellen" headers={["Quelle", "Referrer", "UTM Source", "UTM Medium", "UTM Campaign", "Tab-Sitzungen", "Analytics-Anfragen", "Sitzungen mit Anfrage", "Sitzungen"]} rows={(data as AnalyticsTraffic).items.map(row => {
    const selection: ReportSelection = { kind: "traffic", referrer_host: row.referrer_host, utm_source: row.utm_source, utm_medium: row.utm_medium, utm_campaign: row.utm_campaign };
    return { key: JSON.stringify(selection), cells: [row.source_kind, row.referrer_host ?? "—", row.utm_source ?? "—", row.utm_medium ?? "—", row.utm_campaign ?? "—", formatNumber(row.sessions), formatNumber(row.analytics_conversions), reportRatio(row.converted_sessions, row.sessions), <SessionsLink key="sessions" days={days} selection={selection} />] };
  })} />;
  const report = data as AnalyticsConversions;
  return <>
    <Table title="Formulare · Anzahl führt zu passenden Sitzungen" headers={["Formular", "Open", "Submit", "Success", "Error"]} rows={report.forms.map(row => ({ key: row.form_id, cells: [row.form_id, ...([['opens', 'form_open'], ['submits', 'form_submit'], ['successes', 'form_success'], ['errors', 'form_error']] as const).map(([field, event_name]) => <SessionsLink key={field} days={days} selection={{ kind: "form", form_id: row.form_id, event_name }}>{formatNumber(row[field])}</SessionsLink>)] }))} />
    <Table title="Website Quiz · eindeutige Runs" headers={["Quiz", "Gestartet", "Abgeschlossen"]} rows={report.quizzes.map(row => ({ key: row.quiz_id, cells: [row.quiz_id, <SessionsLink key="starts" days={days} selection={{ kind: "quiz", quiz_id: row.quiz_id, event_name: "quiz_started" }}>{formatNumber(row.starts)}</SessionsLink>, <SessionsLink key="completions" days={days} selection={{ kind: "quiz", quiz_id: row.quiz_id, event_name: "quiz_completed" }}>{formatNumber(row.completions)}</SessionsLink>] }))} />
    <Table title="Externe Absichten · Klicks" headers={["Ziel", "Klicks", "Sitzungen"]} rows={report.intents.map(row => ({ key: row.destination, cells: [row.destination, formatNumber(row.clicks), <SessionsLink key="sessions" days={days} selection={{ kind: "intent", destination: row.destination }} />] }))} />
  </>;
}
