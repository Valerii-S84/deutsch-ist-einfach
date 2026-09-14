"use client";

import { DeutschmitNavigation } from "../deutschmit/analytics-ui";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchWebsiteAnalyticsOverview } from "@/lib/site-analytics-client";

import { PERIOD_OPTIONS } from "./dashboard-config";
import { DashboardWebsiteAnalyticsSection } from "./dashboard-website-analytics-section";
import type { WebsiteAnalyticsOverviewData } from "@/lib/site-analytics-contract";

function periodToDays(period: string): number {
  const parsed = Number.parseInt(period, 10);
  return Number.isFinite(parsed) ? parsed : 7;
}

export default function DashboardPage() {
  const [period, setPeriod] = useState("7d");
  const websiteAnalyticsDays = periodToDays(period);

  const {
    data: websiteAnalyticsData,
    error: websiteAnalyticsError,
    isLoading: isWebsiteAnalyticsLoading,
  } = useQuery<WebsiteAnalyticsOverviewData, Error>({
    queryKey: ["website-analytics", websiteAnalyticsDays],
    queryFn: () => fetchWebsiteAnalyticsOverview(websiteAnalyticsDays),
  });

  return (
    <main className="min-w-0 space-y-6 py-2">
      <DeutschmitNavigation active="legacy" />
      <header className="surface rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ember/60">Статистика сайту</p>
            <h2 className="mt-1 text-3xl">Історичні дані сайту</h2>
            <p className="mt-2 text-sm text-ember/70">
              Дані попередньої системи обліку за вибраний період. Вони не додаються до поточних підсумків.
            </p>
          </div>
          <select
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

      <DashboardWebsiteAnalyticsSection
        data={websiteAnalyticsData}
        isLoading={isWebsiteAnalyticsLoading}
        error={websiteAnalyticsError}
      />
    </main>
  );
}
