import { afterEach, describe, expect, it, vi } from "vitest";
import { api, fetchOverview, fetchPromoDetail, fetchUsers } from "./quiz-arena-api";
import fixture from "@/docs/statistics-fixtures/admin-overview-seeded-7d.json";
afterEach(() => vi.unstubAllGlobals());
describe("Quiz Arena client", () => {
  it.each(["7d", "30d", "90d"])("sends and validates period %s", async period => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...fixture, period })));
    vi.stubGlobal("fetch", fetcher);
    expect((await fetchOverview(period)).period).toBe(period);
    expect(fetcher.mock.calls[0][0]).toBe(`/api/admin/quiz-arena/overview?period=${period}`);
  });
  it("rejects a backend period mismatch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture))));
    await expect(fetchOverview("90d")).rejects.toThrow("QUIZ_PERIOD_MISMATCH");
  });
  it("preserves users filter, ordering and pagination", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"items":[],"total":0,"page":2,"pages":0}'));
    vi.stubGlobal("fetch", fetcher);
    await fetchUsers({ page: 2, search: "a&b", sortBy: "daily_challenge_rating" });
    expect(fetcher.mock.calls[0][0]).toContain("page=2&limit=100&search=a%26b&sort_by=daily_challenge_rating");
  });
  it("rejects malformed data instead of returning a zero", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"items":[],"total":"0"}')));
    await expect(fetchUsers()).rejects.toThrow("QUIZ_INVALID_PAYLOAD");
  });
  it("does not replay a failed mutation", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(api.post("/admin/promo", {})).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("uses POST for code reveal", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 403 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchPromoDetail(7, true)).rejects.toThrow();
    expect(fetcher.mock.calls[0][0]).toBe("/api/admin/quiz-arena/promo/7/reveal");
    expect(fetcher.mock.calls[0][1].method).toBe("POST");
  });
});
