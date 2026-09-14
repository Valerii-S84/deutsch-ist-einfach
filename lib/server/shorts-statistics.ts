import "server-only";
import { shortsReportSchema, type ShortsEvent } from "@/lib/analytics/shorts-contract";

export async function requestShortsService(query: { days: number; page: number; session?: string } | { events: ShortsEvent[] }) {
  const base = process.env.ANALYTICS_SERVICE_URL, key = process.env.ANALYTICS_SERVICE_KEY;
  if (!base || !key || key.length < 32) throw new Error("shorts_source_unavailable");
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("shorts_source_unavailable");
  const posting = "events" in query;
  url.pathname = `/internal/products/shorts-blocker-kids/${posting ? "events" : "report"}`;
  if (!posting) {
    url.searchParams.set("days", String(query.days)); url.searchParams.set("page", String(query.page));
    if (query.session) url.searchParams.set("session", query.session);
  }
  const response = await fetch(url, { method: posting ? "POST" : "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: posting ? JSON.stringify(query) : undefined });
  if (!response.ok) throw new Error("shorts_source_unavailable");
  return await response.json() as unknown;
}
export async function readShortsStatistics(days: number, page: number, session?: string) {
  const report = shortsReportSchema.parse(await requestShortsService({ days, page, session }));
  if (report.days !== days || report.page !== page || report.selected_session !== (session ?? null) || Math.abs(Date.now() - Date.parse(report.generated_at)) > 60_000) throw new Error("shorts_source_invalid");
  return report;
}
