"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { AnalyticsReportDays } from "@/lib/analytics/report-contract";

export const PERIOD_OPTIONS: readonly { value: AnalyticsReportDays; label: string }[] = [
  { value: 7, label: "7 Tage" },
  { value: 30, label: "30 Tage" },
  { value: 90, label: "90 Tage" },
];

export function DeutschmitNavigation({ active }: { active: "overview" | "sessions" | "pages" | "events" | "traffic" | "conversions" | "requests" | "legacy" }) {
  return (
    <header className="surface rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ember/60">Website Analytics v2</p>
          <h1 className="mt-1 text-3xl">deutschmit.de</h1>
        </div>
        <nav aria-label="Website Analytics Navigation" className="flex flex-wrap gap-2 text-sm">
          <Link className={active === "overview" ? "rounded-lg bg-ember px-3 py-2 text-sand" : "rounded-lg border border-ember/20 px-3 py-2"} href="/admin/deutschmit/overview">Overview</Link>
          <Link className={active === "sessions" ? "rounded-lg bg-ember px-3 py-2 text-sand" : "rounded-lg border border-ember/20 px-3 py-2"} href="/admin/deutschmit/sessions">Sessions</Link>
          <Link className="rounded-lg border border-ember/20 px-3 py-2" href="/admin/dashboard">Стара статистика сайту</Link>
          {([['pages', 'Pages'], ['events', 'Clicks/Events'], ['traffic', 'Traffic'], ['conversions', 'Conversions']] as const).map(([name, label]) => <Link key={name} className={active === name ? "rounded-lg bg-ember px-3 py-2 text-sand" : "rounded-lg border border-ember/20 px-3 py-2"} href={{ pathname: `/admin/deutschmit/${name}` }}>{label}</Link>)}
          <Link className="rounded-lg border border-ember/20 px-3 py-2" href="/admin/deutschmit/requests">Заявки та архів</Link>
        </nav>
      </div>
    </header>
  );
}

export function PeriodSelect({ value, onChange }: { value: AnalyticsReportDays; onChange: (value: AnalyticsReportDays) => void }) {
  return (
    <select aria-label="Zeitraum" value={value} onChange={event => onChange(Number(event.target.value) as AnalyticsReportDays)} className="rounded-xl border border-ember/20 bg-white px-3 py-2">
      {PERIOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

export function AnalyticsMeta({ generatedAt, lastReceivedAt, historyAvailableFrom, periodStart, days }: { generatedAt: string; lastReceivedAt: string | null; historyAvailableFrom: string | null; periodStart: string; days: AnalyticsReportDays }) {
  return (
    <dl className="grid gap-2 text-xs text-ember/65 sm:grid-cols-2 lg:grid-cols-4">
      <div><dt className="font-semibold">Quelle</dt><dd>Website Analytics v2</dd></div>
      <div><dt className="font-semibold">UTC-Zeitraum</dt><dd>{formatDateTime(periodStart)} – {formatDateTime(generatedAt)} ({days} Tage, Ende exklusiv)</dd></div>
      <div><dt className="font-semibold">Historie ab</dt><dd>{historyAvailableFrom ? formatDateTime(historyAvailableFrom) : "Noch keine Beobachtungen"}</dd></div>
      <div><dt className="font-semibold">Berechnet</dt><dd>{formatDateTime(generatedAt)} · zuletzt empfangen: {lastReceivedAt ? formatDateTime(lastReceivedAt) : "keine Daten"}</dd></div>
    </dl>
  );
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE").format(value);
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

export function formatDuration(activeMs: number | null): string {
  if (activeMs === null) return "Keine Daten";
  if (activeMs < 1000) return `${activeMs} ms`;
  const seconds = Math.round(activeMs / 1000);
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

export function SnapshotNotice({ generatedAt }: { generatedAt: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return now - Date.parse(generatedAt) > 300_000 ? <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Snapshot ist älter als 5 Minuten. Bitte aktualisieren.</p> : null;
}

export function RefreshReport({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  return <button type="button" disabled={refreshing} onClick={onRefresh} className="rounded-xl border border-ember/20 px-3 py-2 text-sm disabled:opacity-50">{refreshing ? "Wird geladen…" : "Aktualisieren"}</button>;
}

export function sessionStatus(status: "active" | "timed_out" | "unknown") {
  return status === "timed_out" ? "Inaktiv (30 Minuten)" : status === "active" ? "Aktiv im Snapshot" : "Aktivität unbekannt";
}

export function ReportState({ loading, error, children }: { loading: boolean; error: Error | null; children: React.ReactNode }) {
  if (loading) return <p className="surface rounded-2xl p-5" role="status">Wird geladen…</p>;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50/80 p-5" role="alert"><p className="font-semibold text-red-800">Analytics sind nicht verfügbar.</p><p className="mt-1 text-sm text-red-700">Die Abfrage konnte nicht bestätigt werden. Bitte erneut versuchen.</p></div>;
  return <>{children}</>;
}
