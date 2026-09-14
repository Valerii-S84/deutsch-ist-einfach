"use client";

import { useMemo, useState } from "react";
import { DataFreshness } from "../data-freshness";
import { useQuery } from "@tanstack/react-query";

import {
  fetchOverview,
} from "@/lib/quiz-arena-api";
import type { OverviewPayloadSections } from "@/lib/quiz-arena-statistics";

import { overviewConsistencyNotes } from "@/lib/quiz-arena-consistency";
import { normalizeOverviewData } from "./dashboard-normalization";
import { PERIOD_OPTIONS } from "./dashboard-config";
import { DashboardOverviewSections } from "./dashboard-overview-sections";

export default function DashboardPage() {
  const [period, setPeriod] = useState("7d");

  const { data, error: queryError, isLoading, dataUpdatedAt } = useQuery<OverviewPayloadSections, Error>({
    queryKey: ["quiz-arena", "overview", period],
    queryFn: () => fetchOverview(period),
    retry: false,
    refetchInterval: 60_000,
  });

  const overviewModel = useMemo(() => {
    if (!data) {
      return null;
    }
    return normalizeOverviewData(data);
  }, [data]);

  return (
    <main className="min-w-0 space-y-6 py-2">
      {data && !queryError ? <DataFreshness receivedAt={dataUpdatedAt} generatedAt={data.generated_at} /> : null}
      <header className="surface rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ember/60">Статистика бота</p>
            <h1 className="mt-1 text-3xl">Огляд Quiz Arena Bot</h1>
            <p className="mt-2 text-sm text-ember/70">
              Активність, користувачі та покупки Quiz Arena Bot. Період — 7, 30 або 90 днів. Активність за добу, тиждень і місяць має власні фіксовані вікна; підписки показано на поточну мить. Деталі обчислень наведені біля показників.
            </p>
            {overviewModel ? (
              <p className="mt-1 text-xs text-ember/60">
                Останнє оновлення: {overviewModel.generatedAtLabel} (Berlin)
              </p>
            ) : null}
          </div>
          <select
            aria-label="Період Quiz Arena"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="rounded-xl border border-ember/20 bg-white px-3 py-2"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {isLoading ? <p className="text-sm">Статистика бота завантажується…</p> : null}

      {queryError ? (
        <section role="alert" className="surface rounded-2xl border border-red-200 bg-red-50/70 p-5">
          <p className="text-sm font-medium text-red-800">
            Не вдалося завантажити або перевірити статистику бота.
          </p>
          <p className="mt-1 text-xs text-red-700">{queryError.message}</p>
        </section>
      ) : null}

      {data && !queryError ? overviewConsistencyNotes(data).map((note) => <p role="alert" className="text-amber-800" key={note}>{note}</p>) : null}
      {overviewModel && !queryError ? <DashboardOverviewSections model={overviewModel} /> : null}


    </main>
  );
}
