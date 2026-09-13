import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWebsiteAnalyticsOverview } from "./site-analytics-client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("site analytics client", () => {
  it("uses the site endpoint even when a Quiz Arena API is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://quiz-arena.example");
    const payload = { days: 30, totals: { page_views_total: 1 } };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(payload));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchWebsiteAnalyticsOverview(30)).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/admin/website-analytics/overview?days=30", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: expect.any(AbortSignal),
    });
  });

  it.each([[401, "AUTH_REQUIRED"], [503, "Analytics unavailable"]] as const)(
    "reports status %s without backend details", async (status, message) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private details", { status })));
      await expect(fetchWebsiteAnalyticsOverview(7)).rejects.toThrow(message);
    },
  );
});
