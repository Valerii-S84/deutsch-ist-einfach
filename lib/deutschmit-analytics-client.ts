import { z } from "zod";
import { applicationReportSchemas, type ApplicationReportName } from "@/lib/analytics/application-report-contract";
import type { ReportSelection } from "@/lib/analytics/report-selection";

import {
  analyticsOverviewSchema,
  analyticsSessionSchema,
  analyticsSessionsSchema,
  type AnalyticsOverview,
  type AnalyticsReportDays,
  type AnalyticsSession,
  type AnalyticsSessions,
} from "@/lib/analytics/report-contract";

async function getJson(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("ANALYTICS_UNAVAILABLE");
  }
  if (!response.ok) throw new Error("ANALYTICS_UNAVAILABLE");
  try {
    return await response.json();
  } catch {
    throw new Error("ANALYTICS_INVALID_RESPONSE");
  }
}

function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) throw new Error("ANALYTICS_INVALID_RESPONSE");
  return result.data;
}

export async function fetchDeutschmitOverview(days: AnalyticsReportDays): Promise<AnalyticsOverview> {
  return parse(analyticsOverviewSchema, await getJson(`/api/admin/analytics/deutschmit/overview?days=${days}`));
}

export async function fetchDeutschmitSessions(options: {
  selection?: ReportSelection;
  days: AnalyticsReportDays;
  page: number;
  path?: string;
  eventName?: AnalyticsSessions["filters"]["event_name"];
}): Promise<AnalyticsSessions> {
  const query = new URLSearchParams({ days: String(options.days), page: String(options.page) });
  if (options.path) query.set("path", options.path);
  if (options.eventName) query.set("event_name", options.eventName);
  if (options.selection) query.set("selection", JSON.stringify(options.selection));
  return parse(analyticsSessionsSchema, await getJson(`/api/admin/analytics/deutschmit/sessions?${query.toString()}`));
}

export async function fetchDeutschmitReport(name: ApplicationReportName, days: AnalyticsReportDays) {
  const result = applicationReportSchemas[name].safeParse(await getJson(`/api/admin/analytics/deutschmit/${name}?days=${days}`));
  if (!result.success || result.data.days !== days) throw new Error("ANALYTICS_INVALID_RESPONSE");
  return result.data;
}

export async function fetchDeutschmitSession(sessionId: string): Promise<AnalyticsSession> {
  return parse(analyticsSessionSchema, await getJson(`/api/admin/analytics/deutschmit/sessions/${encodeURIComponent(sessionId)}`));
}
