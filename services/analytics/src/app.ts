import { createHash, timingSafeEqual } from "node:crypto";
import { analyticsId, EVENT_NAMES, normalizeAnalyticsPath, parseAnalyticsBatch } from "../../../lib/analytics/contract";
import { isAnalyticsReportDays, type AnalyticsReportDays } from "../../../lib/analytics/report-contract";
import { AnalyticsHttpError, readAnalyticsJson } from "../../../lib/analytics/http";
import { insertEvents, type AnalyticsDatabase } from "./database";
import { readOverview, readSession, readSessions } from "./reports";
import { readPages, readEvents, readTraffic, readConversions } from "./application-reports";
import { parseReportSelection } from "../../../lib/analytics/report-selection";
import { handleShorts } from "./shorts";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function createAnalyticsHandler(sql: AnalyticsDatabase, key: string) {
  if (Buffer.byteLength(key) < 32 || !/^[\x21-\x7e]+$/.test(key)) throw new Error("analytics_key_not_configured");
  const expected = createHash("sha256").update(`Bearer ${key}`).digest();
  return async (request: Request): Promise<Response> => {
    const actual = createHash("sha256").update(request.headers.get("authorization") ?? "").digest();
    if (!timingSafeEqual(expected, actual)) return json({ error: "AUTH_REQUIRED" }, 401);
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/internal/products/shorts-blocker-kids/")) return await handleShorts(request, sql);
      if (url.pathname === "/health" && request.method === "GET") {
        if (url.search) return json({ error: "invalid_query" }, 400);
        await sql`SELECT 1 FROM analytics_events LIMIT 1`;
        return json({ ok: true });
      }
      if (["/internal/events/browser", "/internal/events/server"].includes(url.pathname) && request.method === "POST") {
        if (url.search) return json({ error: "invalid_query" }, 400);
        const source = url.pathname.endsWith("/server") ? "server" : "browser";
        const payload = await readAnalyticsJson(request);
        let events;
        try { events = parseAnalyticsBatch(payload, source); }
        catch { return json({ error: "invalid_payload" }, 400); }
        return json(await insertEvents(sql, events, source));
      }
      if (url.pathname === "/internal/products/deutschmit/overview" && request.method === "GET") {
        const days = parseDays(url.searchParams, ["days"]);
        if (days === null) return json({ error: "invalid_report_query" }, 400);
        return json(await readOverview(sql, days));
      }
      if (url.pathname === "/internal/products/deutschmit/sessions" && request.method === "GET") {
        const days = parseDays(url.searchParams, ["days", "page", "path", "event_name", "selection"]);
        const selection = parseReportSelection(url.searchParams.get("selection"));
        const page = parsePage(url.searchParams);
        const path = parsePath(url.searchParams);
        const eventName = parseEventName(url.searchParams);
        if (days === null || page === null || path === false || eventName === false || selection === false) return json({ error: "invalid_report_query" }, 400);
        return json(await readSessions(sql, { days, page, path: path ?? undefined, eventName: eventName ?? null, selection }));
      }
      if (url.pathname === "/internal/products/deutschmit/pages" && request.method === "GET") {
        const days = parseDays(url.searchParams, ["days"]);
        return days === null ? json({ error: "invalid_report_query" }, 400) : json(await readPages(sql, days));
      }
      if (url.pathname === "/internal/products/deutschmit/events" && request.method === "GET") {
        const days = parseDays(url.searchParams, ["days"]);
        return days === null ? json({ error: "invalid_report_query" }, 400) : json(await readEvents(sql, days));
      }
      if (url.pathname === "/internal/products/deutschmit/traffic" && request.method === "GET") {
        const days = parseDays(url.searchParams, ["days"]);
        return days === null ? json({ error: "invalid_report_query" }, 400) : json(await readTraffic(sql, days));
      }
      if (url.pathname === "/internal/products/deutschmit/conversions" && request.method === "GET") {
        const days = parseDays(url.searchParams, ["days"]);
        return days === null ? json({ error: "invalid_report_query" }, 400) : json(await readConversions(sql, days));
      }
      const match = /^\/internal\/products\/deutschmit\/sessions\/([^/]+)$/.exec(url.pathname);
      if (match && request.method === "GET") {
        if (url.search) return json({ error: "invalid_query" }, 400);
        const sessionId = analyticsId.safeParse(match[1]);
        if (!sessionId.success) return json({ error: "invalid_session" }, 400);
        return json(await readSession(sql, sessionId.data));
      }
      return json({ error: "NOT_FOUND" }, 404);
    } catch (error) {
      if (error instanceof AnalyticsHttpError) return json({ error: error.code }, error.status);
      // Never log database errors, SQL parameters, request payloads, identifiers or IPs.
      return json({ error: "analytics_unavailable" }, 503);
    }
  };
}

function hasOnlyParams(params: URLSearchParams, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  for (const key of params.keys()) {
    if (!allowedSet.has(key) || params.getAll(key).length !== 1) return false;
  }
  return true;
}

function parseDays(params: URLSearchParams, allowed: readonly string[]): AnalyticsReportDays | null {
  if (!hasOnlyParams(params, allowed)) return null;
  const value = Number(params.get("days") ?? 7);
  return Number.isSafeInteger(value) && isAnalyticsReportDays(value) ? value : null;
}

function parsePage(params: URLSearchParams): number | null {
  const value = Number(params.get("page") ?? 1);
  return Number.isSafeInteger(value) && value >= 1 && value <= 100_000 ? value : null;
}

function parsePath(params: URLSearchParams): string | null | false {
  if (!params.has("path")) return null;
  const value = params.get("path");
  if (!value || value.length > 2048) return false;
  if (value === "unknown") return value;
  const normalized = normalizeAnalyticsPath(value);
  return normalized === "unknown" ? false : normalized;
}

function parseEventName(params: URLSearchParams): typeof EVENT_NAMES[number] | null | false {
  if (!params.has("event_name")) return null;
  const value = params.get("event_name");
  return value && (EVENT_NAMES as readonly string[]).includes(value) ? value as typeof EVENT_NAMES[number] : false;
}
