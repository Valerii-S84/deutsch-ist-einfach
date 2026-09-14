"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { AnalyticsReportDays } from "@/lib/analytics/report-contract";

export const PERIOD_OPTIONS: readonly { value: AnalyticsReportDays; label: string }[] = [
  { value: 7, label: "7 днів" },
  { value: 30, label: "30 днів" },
  { value: 90, label: "90 днів" },
];

export function DeutschmitNavigation({ active }: { active: "overview" | "sessions" | "pages" | "events" | "traffic" | "conversions" | "requests" | "legacy" }) {
  return (
    <header className="surface rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ember/60">Статистика сайту</p>
          <h1 className="mt-1 text-3xl">deutschmit.de</h1>
        </div>
        <nav aria-label="Розділи статистики сайту" className="flex flex-wrap gap-2 text-sm">
          <Link className={active === "overview" ? "rounded-lg bg-ember px-3 py-2 text-sand" : "rounded-lg border border-ember/20 px-3 py-2"} href="/admin/deutschmit/overview">Огляд</Link>
          <Link className={active === "sessions" ? "rounded-lg bg-ember px-3 py-2 text-sand" : "rounded-lg border border-ember/20 px-3 py-2"} href="/admin/deutschmit/sessions">Відвідування</Link>
          <details className="rounded-lg border border-ember/20 px-3 py-2" open={active === "legacy"}><summary className="cursor-pointer">Історичні дані</summary><p className="mt-2 max-w-xs text-xs">Попередня система обліку. Дані збережені окремо й не додаються до поточних підсумків.</p><Link className="mt-2 block underline" href="/admin/dashboard">Переглянути історичні дані сайту</Link></details>
          {([['pages', 'Сторінки'], ['events', 'Натискання та дії'], ['traffic', 'Джерела переходів'], ['conversions', 'Результати дій']] as const).map(([name, label]) => <Link key={name} className={active === name ? "rounded-lg bg-ember px-3 py-2 text-sand" : "rounded-lg border border-ember/20 px-3 py-2"} href={{ pathname: `/admin/deutschmit/${name}` }}>{label}</Link>)}
          <Link className="rounded-lg border border-ember/20 px-3 py-2" href="/admin/deutschmit/requests">Заявки та архів</Link>
        </nav>
      </div>
    </header>
  );
}

export function PeriodSelect({ value, onChange }: { value: AnalyticsReportDays; onChange: (value: AnalyticsReportDays) => void }) {
  return (
    <select aria-label="Період" value={value} onChange={event => onChange(Number(event.target.value) as AnalyticsReportDays)} className="rounded-xl border border-ember/20 bg-white px-3 py-2">
      {PERIOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

export function AnalyticsMeta({ generatedAt, lastReceivedAt, historyAvailableFrom, periodStart, days }: { generatedAt: string; lastReceivedAt: string | null; historyAvailableFrom: string | null; periodStart: string; days: AnalyticsReportDays }) {
  return (
    <details className="text-sm"><summary className="cursor-pointer">Джерело, період і свіжість даних</summary><dl className="mt-3 grid gap-2 text-xs text-ember/65 sm:grid-cols-2 lg:grid-cols-4">
      <div><dt className="font-semibold">Джерело</dt><dd>Статистика сайту</dd></div>
      <div><dt className="font-semibold">Період у UTC</dt><dd>{formatDateTime(periodStart)} – {formatDateTime(generatedAt)} ({days} днів, кінцеву мить не включено)</dd></div>
      <div><dt className="font-semibold">Найдавніша збережена подія</dt><dd>{historyAvailableFrom ? formatDateTime(historyAvailableFrom) : "Спостережень ще немає"}</dd></div>
      <div><dt className="font-semibold">Оновлено</dt><dd>{formatDateTime(generatedAt)} · остання отримана подія: {lastReceivedAt ? formatDateTime(lastReceivedAt) : "немає даних"}</dd></div>
    </dl></details>
  );
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("uk-UA").format(value);
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

export function formatDuration(activeMs: number | null): string {
  if (activeMs === null) return "Немає даних";
  if (activeMs < 1000) return `${activeMs} мс`;
  const seconds = Math.round(activeMs / 1000);
  if (seconds < 60) return `${seconds} с`;
  return `${Math.floor(seconds / 60)} хв ${seconds % 60} с`;
}

export function SnapshotNotice({ generatedAt }: { generatedAt: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return now - Date.parse(generatedAt) > 300_000 ? <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Дані старші за 5 хвилин. Оновіть звіт.</p> : null;
}

export function RefreshReport({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  return <button type="button" disabled={refreshing} onClick={onRefresh} className="rounded-xl border border-ember/20 px-3 py-2 text-sm disabled:opacity-50">{refreshing ? "Завантаження…" : "Оновити"}</button>;
}

export function sessionStatus(status: "active" | "timed_out" | "unknown") {
  return status === "timed_out" ? "Без дій понад 30 хвилин" : status === "active" ? "Активне на час звіту" : "Активність невідома";
}

export function ReportState({ loading, error, children }: { loading: boolean; error: Error | null; children: React.ReactNode }) {
  if (loading) return <p className="surface rounded-2xl p-5" role="status">Завантаження…</p>;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50/80 p-5" role="alert"><p className="font-semibold text-red-800">Статистика тимчасово недоступна.</p><p className="mt-1 text-sm text-red-700">Не вдалося отримати дані джерела. Спробуйте оновити звіт.</p></div>;
  return <>{children}</>;
}
