"use client";
import Link from "next/link";

import type { WebsiteAnalyticsOverviewData } from "@/lib/site-analytics-contract";

type DashboardWebsiteAnalyticsSectionProps = {
  data: WebsiteAnalyticsOverviewData | undefined;
  isLoading: boolean;
  error: Error | null;
};

function formatNumber(value: number | undefined): string {
  return value === undefined ? "—" : new Intl.NumberFormat("uk-UA").format(value);
}

function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

export function DashboardWebsiteAnalyticsSection({
  data,
  isLoading,
  error,
}: DashboardWebsiteAnalyticsSectionProps) {
  if (error || isLoading) data = undefined;
  const latestSeries = data?.daily_series.slice(-7) ?? [];

  return (
    <section className="surface rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">Історична статистика сайту</h2>
          <p className="mt-1 text-sm text-ember/70">Останні {data?.days ?? 7} днів</p>
        </div>
        {isLoading ? <p className="text-xs text-ember/60">Завантаження…</p> : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50/80 p-3">
          <p className="text-sm font-medium text-red-800">
            Не вдалося завантажити історичну статистику сайту.
          </p>
          <p className="mt-1 text-xs text-red-700">{error.message}</p>
          <Link className="mt-2 inline-block underline" href="/admin/quiz-arena/login">Увійти в Quiz Arena для доступу до історичного джерела</Link>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-ember/15 bg-white/70 p-3">
          <p className="text-xs uppercase tracking-wide text-ember/60">Відвідувачі сайту</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatNumber(data?.totals.unique_visitors_total)}
          </p>
        </article>
        <article className="rounded-xl border border-ember/15 bg-white/70 p-3">
          <p className="text-xs uppercase tracking-wide text-ember/60">Перегляди сторінок</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatNumber(data?.totals.page_views_total)}
          </p>
        </article>
        <article className="rounded-xl border border-ember/15 bg-white/70 p-3">
          <p className="text-xs uppercase tracking-wide text-ember/60">Переходи в Telegram</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatNumber(data?.totals.telegram_cta_clicks_total)}
          </p>
        </article>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ember/80">Активність за днями</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ember/50">
                <tr>
                  <th className="py-2 pr-3">Дата</th>
                  <th className="py-2 pr-3">Відвідувачі</th>
                  <th className="py-2 pr-3">Перегляди</th>
                  <th className="py-2 pr-3">Telegram</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ember/10">
                {latestSeries.map((point) => (
                  <tr key={point.date}>
                    <td className="py-2 pr-3">{formatDateLabel(point.date)}</td>
                    <td className="py-2 pr-3">{formatNumber(point.unique_visitors)}</td>
                    <td className="py-2 pr-3">{formatNumber(point.page_views)}</td>
                    <td className="py-2 pr-3">{formatNumber(point.telegram_cta_clicks)}</td>
                  </tr>
                ))}
                {latestSeries.length === 0 ? (
                  <tr>
                    <td className="py-2 pr-3 text-ember/60" colSpan={4}>
                      Немає даних
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ember/80">Найпопулярніші сторінки</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ember/50">
                <tr>
                  <th className="py-2 pr-3">Сторінка</th>
                  <th className="py-2 pr-3">Перегляди</th>
                  <th className="py-2 pr-3">Відвідувачі</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ember/10">
                {(data?.top_pages ?? []).map((page) => (
                  <tr key={page.path}>
                    <td className="max-w-[220px] truncate py-2 pr-3" title={page.path}>
                      {page.path}
                    </td>
                    <td className="py-2 pr-3">{formatNumber(page.page_views)}</td>
                    <td className="py-2 pr-3">{formatNumber(page.unique_visitors)}</td>
                  </tr>
                ))}
                {data?.top_pages.length === 0 ? (
                  <tr>
                    <td className="py-2 pr-3 text-ember/60" colSpan={3}>
                      Немає даних
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
