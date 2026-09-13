import type { WebsiteAnalyticsOverviewData } from "@/lib/site-analytics-contract";

export async function fetchWebsiteAnalyticsOverview(days: number): Promise<WebsiteAnalyticsOverviewData> {
  const response = await fetch(`/api/admin/website-analytics/overview?days=${days}`, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(response.status === 401 ? "AUTH_REQUIRED" : "Analytics unavailable");
  }

  return response.json();
}
