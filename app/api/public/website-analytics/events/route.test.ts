// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SiteAnalyticsEventPayload } from "@/lib/site-analytics-contract";
import { saveSiteAnalyticsEvent } from "@/lib/server/site-analytics-store";

import { POST } from "./route";

vi.mock("@/lib/server/site-analytics-store", () => ({
  saveSiteAnalyticsEvent: vi.fn(),
}));

const saveSiteAnalyticsEventMock = vi.mocked(saveSiteAnalyticsEvent);

const pageViewPayload: SiteAnalyticsEventPayload = {
  event_type: "page_view",
  visitor_id: "1234567890abcdef",
  path: "/wissen",
  referrer: "example.com/start",
  utm_source: "newsletter",
  utm_medium: "email",
  utm_campaign: "september",
  timestamp: "2026-09-03T10:00:00.000Z",
};

const telegramClickPayload: SiteAnalyticsEventPayload = {
  event_type: "telegram_cta_click",
  visitor_id: "abcdef1234567890",
  path: "/",
  timestamp: "2026-09-03T10:05:00.000Z",
  metadata: {
    public_event_name: "hero_cta_click",
    section: "hero",
    cta: "telegram_bot",
    destination: "telegram_bot",
  },
};

function analyticsRequest(body: BodyInit | null, headers: HeadersInit = {}) {
  return withTestPeer(new Request(
    "https://site.example/api/public/website-analytics/events",
    {
      method: "POST",
      headers,
      body,
    },
  ));
}

async function expectErrorResponse(
  response: Response,
  status: number,
  error: string,
) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({ error });
}

beforeEach(() => {
  saveSiteAnalyticsEventMock.mockReset();
  saveSiteAnalyticsEventMock.mockResolvedValue(undefined);
});

describe("POST /api/public/website-analytics/events", () => {
  it("persists a valid page_view and returns 204", async () => {
    const response = await POST(
      analyticsRequest(JSON.stringify(pageViewPayload), {
        "Content-Type": "application/json",
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.text()).resolves.toBe("");
    expect(saveSiteAnalyticsEventMock).toHaveBeenCalledOnce();
    expect(saveSiteAnalyticsEventMock).toHaveBeenCalledWith(pageViewPayload);
  });

  it("persists a valid telegram_cta_click and returns 204", async () => {
    const response = await POST(
      analyticsRequest(JSON.stringify(telegramClickPayload), {
        "Content-Type": "application/json",
      }),
    );

    expect(response.status).toBe(204);
    expect(saveSiteAnalyticsEventMock).toHaveBeenCalledOnce();
    expect(saveSiteAnalyticsEventMock).toHaveBeenCalledWith(
      telegramClickPayload,
    );
  });

  it("returns a client error for malformed JSON without writing", async () => {
    const response = await POST(
      analyticsRequest('{"event_type":"page_view"', {
        "Content-Type": "application/json",
      }),
    );

    await expectErrorResponse(response, 400, "invalid_json");
    expect(saveSiteAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("returns a client error for an invalid payload without writing", async () => {
    const { visitor_id: _visitorId, ...invalidPayload } = pageViewPayload;
    const response = await POST(
      analyticsRequest(JSON.stringify(invalidPayload), {
        "Content-Type": "application/json",
      }),
    );

    await expectErrorResponse(response, 422, "invalid_payload");
    expect(saveSiteAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("rejects an unsupported event_type", async () => {
    const response = await POST(
      analyticsRequest(
        JSON.stringify({ ...pageViewPayload, event_type: "wizard_open" }),
        { "Content-Type": "application/json" },
      ),
    );

    await expectErrorResponse(response, 422, "invalid_payload");
    expect(saveSiteAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("accepts a valid payload without optional fields", async () => {
    const minimalPayload: SiteAnalyticsEventPayload = {
      event_type: "page_view",
      visitor_id: "minimal123456789",
      path: "/books",
      timestamp: "2026-09-03T11:00:00.000Z",
    };

    const response = await POST(
      analyticsRequest(JSON.stringify(minimalPayload), {
        "Content-Type": "application/json",
      }),
    );

    expect(response.status).toBe(204);
    expect(saveSiteAnalyticsEventMock).toHaveBeenCalledOnce();
    expect(saveSiteAnalyticsEventMock).toHaveBeenCalledWith(minimalPayload);
  });

  it("returns 500 rather than 204 when persistence rejects", async () => {
    saveSiteAnalyticsEventMock.mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    const response = await POST(
      analyticsRequest(JSON.stringify(pageViewPayload), {
        "Content-Type": "application/json",
      }),
    );

    await expectErrorResponse(response, 500, "analytics_persistence_failed");
    expect(response.status).not.toBe(204);
    expect(saveSiteAnalyticsEventMock).toHaveBeenCalledOnce();
  });

  it("does not require auth, cookies, or a CSRF header", async () => {
    const request = analyticsRequest(JSON.stringify(pageViewPayload));

    expect(request.headers.get("authorization")).toBeNull();
    expect(request.headers.get("cookie")).toBeNull();
    expect(request.headers.get("x-csrf-token")).toBeNull();

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(saveSiteAnalyticsEventMock).toHaveBeenCalledOnce();
  });
});

vi.mock("server-only", () => ({}));
let testPeer = 0;
beforeEach(() => vi.stubEnv("ANALYTICS_TRUST_PROXY", "1"));
afterEach(() => vi.unstubAllEnvs());

function withTestPeer(request: Request) {
  if (!request.headers.has("origin")) request.headers.set("origin", new URL(request.url).origin);
  if (!request.headers.has("content-type") || request.headers.get("content-type") === "text/plain;charset=UTF-8") request.headers.set("content-type", "application/json");
  if (!request.headers.has("x-forwarded-for")) request.headers.set("x-forwarded-for", "192.0.2." + (++testPeer));
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", new URL(request.url).origin);
  return request;
}

it("rejects foreign origins and cross-site metadata before reading or saving", async () => {
  for (const headers of [{ Origin: "https://evil.example" }, { "Sec-Fetch-Site": "cross-site" }] as Record<string, string>[]) {
    const request = analyticsRequest(JSON.stringify(pageViewPayload), headers);
    const reader = vi.spyOn(request.body!, "getReader");
    expect((await POST(request)).status).toBe(403);
    expect(reader).not.toHaveBeenCalled();
  }
  expect(saveSiteAnalyticsEventMock).not.toHaveBeenCalled();
});
it("bounds declared and actual legacy body bytes before persistence", async () => {
  const { MAX_BATCH_BYTES } = await import("@/lib/analytics/contract");
  for (const request of [
    analyticsRequest("{}", { "Content-Length": String(MAX_BATCH_BYTES + 1) }),
    analyticsRequest(JSON.stringify({ data: "x".repeat(MAX_BATCH_BYTES) }), { "Content-Length": "2" }),
  ]) expect((await POST(request)).status).toBe(413);
  expect(saveSiteAnalyticsEventMock).not.toHaveBeenCalled();
});
it("limits repeated legacy writes and keeps other clients independent", async () => {
  for (let i = 0; i < 60; i++) expect((await POST(analyticsRequest(JSON.stringify(pageViewPayload), { "X-Forwarded-For": "198.51.100.50" }))).status).toBe(204);
  const response = await POST(analyticsRequest(JSON.stringify(pageViewPayload), { "X-Forwarded-For": "198.51.100.50" }));
  expect(response.status).toBe(429);
  expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
  expect(saveSiteAnalyticsEventMock).toHaveBeenCalledTimes(60);
  expect((await POST(analyticsRequest(JSON.stringify(pageViewPayload), { "X-Forwarded-For": "198.51.100.51" }))).status).toBe(204);
});
