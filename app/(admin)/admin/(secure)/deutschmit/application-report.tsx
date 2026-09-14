"use client";

import { analyticsLabel } from "@/lib/admin-analytics-labels";

import { Suspense, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { isAnalyticsReportDays } from "@/lib/analytics/report-contract";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ApplicationReportName, ApplicationReport, AnalyticsPages, AnalyticsEvents, AnalyticsTraffic, AnalyticsConversions } from "@/lib/analytics/application-report-contract";
import type { ReportSelection } from "@/lib/analytics/report-selection";
import type { AnalyticsReportDays } from "@/lib/analytics/report-contract";
import { fetchDeutschmitReport } from "@/lib/deutschmit-analytics-client";
import { AnalyticsMeta, DeutschmitNavigation, formatDuration, formatNumber, PeriodSelect, RefreshReport, ReportState, SnapshotNotice } from "./analytics-ui";

const titles = { pages: "Сторінки", events: "Натискання та дії", traffic: "Джерела переходів", conversions: "Результати дій" };
const descriptions = {
  pages: "Перегляди та відвідувачі кожної сторінки за вибраний період UTC. Активний час: найбільше виміряне значення для кожного перегляду; середнє лише за переглядами з вимірюванням. Прокручування: найбільша зафіксована частка. Ознака прочитання статті є оцінкою.",
  events: "Повторну доставку тієї самої події відкинуто; окремі натискання враховано. Частка натискань: перегляди з показом і наступним натисканням / перегляди з показом того самого елемента в тому самому місці за період. Натискання без зафіксованого показу наведено окремо.",
  traffic: "Відвідування з діями за вибраний період UTC, згруповані за джерелом входу та мітками кампанії. Переходи всередині сайту не змінюють джерело. Частка заявок: відвідування з підтвердженою заявкою / усі відвідування групи. Прямі переходи та невідоме джерело показано окремо.",
  conversions: "Для форм показано відкриття, спроби надсилання, помилки та окремі підтвердження збережених заявок. Для вікторин — окремі проходження. Натискання зовнішнього посилання не підтверджує покупку, підписку чи завантаження. Ці підсумки можуть стосуватися різних відвідувачів.",
};

export function sessionsHref(days: AnalyticsReportDays, selection: ReportSelection) {
  return `/admin/deutschmit/sessions?${new URLSearchParams({ days: String(days), selection: JSON.stringify(selection) })}`;
}
function SessionsLink({ days, selection, children = "Відвідування" }: { days: AnalyticsReportDays; selection: ReportSelection; children?: ReactNode }) {
  return <Link className="underline underline-offset-2" href={{ pathname: "/admin/deutschmit/sessions", query: { days, selection: JSON.stringify(selection) } }}>{children}</Link>;
}
export function reportRatio(numerator: number, denominator: number) {
  return `${formatNumber(numerator)} / ${formatNumber(denominator)} · ${denominator ? `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 1 }).format(100 * numerator / denominator)} %` : "Не визначено"}`;
}
function Table({ title, headers, rows }: { title: string; headers: string[]; rows: { key: string; cells: ReactNode[] }[] }) {
  return <section className="surface min-w-0 rounded-2xl p-5"><h2 className="text-xl">{title}</h2>{rows.length ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{headers.map(header => <th scope="col" key={header} className="whitespace-nowrap py-2 pr-5 text-xs text-ember/65">{header}</th>)}</tr></thead><tbody className="divide-y divide-ember/10">{rows.map(row => <tr key={row.key}>{row.cells.map((cell, index) => <td key={index} className="py-3 pr-5 align-top break-words">{cell}</td>)}</tr>)}</tbody></table></div> : <p className="mt-4 text-sm">За вибраний період відповідних дій не зафіксовано.</p>}</section>;
}

export function ApplicationReportPage({ name }: { name: ApplicationReportName }) {
  return <Suspense fallback={<p role="status">Завантаження…</p>}><ApplicationReportFromUrl name={name} /></Suspense>;
}

function ApplicationReportFromUrl({ name }: { name: ApplicationReportName }) {
  const params = useSearchParams();
  const days = Number(params.get("days") ?? 7);
  if (!isAnalyticsReportDays(days)) return <p role="alert">Некоректний період звіту.</p>;
  return <ApplicationReport name={name} initialDays={days} key={`${name}/${days}`} />;
}

function ApplicationReport({ name, initialDays }: { name: ApplicationReportName; initialDays: AnalyticsReportDays }) {
  const [days, setDays] = useState<AnalyticsReportDays>(initialDays);
  const query = useQuery({ queryKey: ["deutschmit-analytics", name, days], queryFn: () => fetchDeutschmitReport(name, days), retry: false, staleTime: 0, placeholderData: () => undefined });
  const data = query.data;
  return <main className="min-w-0 space-y-6 py-2">
    <DeutschmitNavigation active={name} />
    <section className="surface rounded-2xl p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl">{titles[name]}</h2><PeriodSelect value={days} onChange={setDays} /></div><details className="mt-3 text-sm text-ember/75"><summary className="cursor-pointer">Як рахуються показники</summary><p className="mt-2">{descriptions[name]}</p></details><p className="mt-3 text-xs text-ember/65">Показано зафіксовані дії браузерів. Ідентифікатор браузера не встановлює особу людини. Блокувальники, втрати доставки та строк зберігання можуть обмежувати дані.</p></section>
    <RefreshReport refreshing={query.isFetching} onRefresh={() => void query.refetch()} />
    <ReportState loading={query.isLoading || query.isFetching} error={query.error}>
      {data && data.days === days ? <><SnapshotNotice generatedAt={data.generated_at} />
        {data.history_available_from ? <ReportTables name={name} data={data} /> : <p className="surface rounded-2xl p-5">Джерело ще не має спостережень. Це не означає, що відвідувачів не було.</p>}
        <AnalyticsMeta generatedAt={data.generated_at} lastReceivedAt={data.last_received_at} historyAvailableFrom={data.history_available_from} periodStart={data.period_start} days={data.days} />
      </> : null}
    </ReportState>
  </main>;
}

export function ReportTables({ name, data }: { name: ApplicationReportName; data: ApplicationReport }) {
  const days = data.days;
  if (name === "pages") return <Table title="Сторінки" headers={["Сторінка", "Перегляди", "Відвідувачі", "Середній активний час", "Перегляди з виміряним часом", "Найбільше прокручування", "Ознаки прочитання", "Відвідування"]} rows={(data as AnalyticsPages).items.map(row => ({ key: row.path, cells: [row.path, formatNumber(row.page_views), formatNumber(row.visitors), formatDuration(row.average_active_ms), formatNumber(row.measured_views), row.max_scroll === null ? "Немає даних" : `${row.max_scroll} %`, formatNumber(row.article_reads), <SessionsLink key="sessions" days={days} selection={{ kind: "page", path: row.path }} />] }))} />;
  if (name === "events") {
    const report = data as AnalyticsEvents;
    return <>
      <Table title="Дії за типом" headers={["Дія", "Кількість", "Відвідування"]} rows={report.events.map(row => ({ key: row.event_name, cells: [analyticsLabel(row.event_name), formatNumber(row.count), <SessionsLink key="sessions" days={days} selection={{ kind: "event", event_name: row.event_name }} />] }))} />
      <Table title="Елементи" headers={["Елемент", "Розташування", "Перегляди з показом", "Натискання", "Частка переглядів із натисканням", "Натискання без зафіксованого показу", "Відвідування"]} rows={report.elements.map(row => ({ key: JSON.stringify([row.element_id, row.placement]), cells: [analyticsLabel(row.element_id), analyticsLabel(row.placement), formatNumber(row.impressions), formatNumber(row.clicks), reportRatio(row.matched_click_views, row.impressions), formatNumber(row.unmatched_clicks), <SessionsLink key="sessions" days={days} selection={{ kind: "element", element_id: row.element_id, placement: row.placement }} />] }))} />
      <Table title="Помилки сайту" headers={["Код", "Компонент", "Кількість", "Відвідування"]} rows={report.errors.map(row => ({ key: `${row.error_code}/${row.component_id}`, cells: [row.error_code, row.component_id, formatNumber(row.count), <SessionsLink key="sessions" days={days} selection={{ kind: "error", error_code: row.error_code, component_id: row.component_id }} />] }))} />
    </>;
  }
  if (name === "traffic") return <Table title="Джерела переходів" headers={["Джерело", "Сайт переходу", "Джерело кампанії", "Канал кампанії", "Кампанія", "Відвідування", "Підтверджені заявки", "Відвідування із заявкою", "Відвідування"]} rows={(data as AnalyticsTraffic).items.map(row => {
    const selection: ReportSelection = { kind: "traffic", referrer_host: row.referrer_host, utm_source: row.utm_source, utm_medium: row.utm_medium, utm_campaign: row.utm_campaign };
    return { key: JSON.stringify(selection), cells: [analyticsLabel(row.source_kind), row.referrer_host ?? "—", row.utm_source ?? "—", row.utm_medium ?? "—", row.utm_campaign ?? "—", formatNumber(row.sessions), formatNumber(row.analytics_conversions), reportRatio(row.converted_sessions, row.sessions), <SessionsLink key="sessions" days={days} selection={selection} />] };
  })} />;
  const report = data as AnalyticsConversions;
  return <>
    <Table title="Форми · натисніть число, щоб побачити відвідування" headers={["Форма", "Відкриття", "Надсилання", "Збережені заявки", "Помилки"]} rows={report.forms.map(row => ({ key: row.form_id, cells: [analyticsLabel(row.form_id), ...([['opens', 'form_open'], ['submits', 'form_submit'], ['successes', 'form_success'], ['errors', 'form_error']] as const).map(([field, event_name]) => <SessionsLink key={field} days={days} selection={{ kind: "form", form_id: row.form_id, event_name }}>{formatNumber(row[field])}</SessionsLink>)] }))} />
    <Table title="Вікторини на сайті · окремі проходження" headers={["Quiz", "Розпочато", "Завершено"]} rows={report.quizzes.map(row => ({ key: row.quiz_id, cells: [analyticsLabel(row.quiz_id), <SessionsLink key="starts" days={days} selection={{ kind: "quiz", quiz_id: row.quiz_id, event_name: "quiz_started" }}>{formatNumber(row.starts)}</SessionsLink>, <SessionsLink key="completions" days={days} selection={{ kind: "quiz", quiz_id: row.quiz_id, event_name: "quiz_completed" }}>{formatNumber(row.completions)}</SessionsLink>] }))} />
    <Table title="Переходи на зовнішні ресурси" headers={["Призначення", "Натискання", "Відвідування"]} rows={report.intents.map(row => ({ key: row.destination, cells: [analyticsLabel(row.destination), formatNumber(row.clicks), <SessionsLink key="sessions" days={days} selection={{ kind: "intent", destination: row.destination }} />] }))} />
  </>;
}
