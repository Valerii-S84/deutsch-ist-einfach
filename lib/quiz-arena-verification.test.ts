import { overviewConsistencyNotes } from "./quiz-arena-consistency";
import { describe, expect, it } from "vitest";
import seven from "@/docs/statistics-fixtures/admin-overview-seeded-7d.json";
import thirty from "@/docs/statistics-fixtures/admin-overview-seeded-30d.json";
import ninety from "@/docs/statistics-fixtures/admin-overview-seeded-90d.json";
import empty from "@/docs/statistics-fixtures/admin-overview-empty-7d.json";
import { parseOverviewPayloadSections } from "./quiz-arena-statistics";
import { normalizeOverviewData } from "@/app/(admin)/admin/(secure)/quiz-arena/dashboard/dashboard-normalization";
describe("historical controlled overview samples", () => {
  it("reports disagreement without changing either source value", () => {
    const parsed = parseOverviewPayloadSections({ ...seven, revenue_series: [{ date: "2026-04-10", stars: 500, eur: 10 }] });
    expect(overviewConsistencyNotes(parsed).some((note) => note.includes("Дохід"))).toBe(true);
    expect(parsed.kpis.data?.revenue_stars?.current).toBe(100);
    expect(parsed.revenue_series.data?.[0].stars).toBe(500);
  });
  it.each([seven, thirty, ninety])("checks card/series arithmetic for $period", fixture => {
    const parsed = parseOverviewPayloadSections(fixture);
    expect(parsed.kpis.status).toBe("valid");
    expect(parsed.feature_usage.status).toBe("valid");
    expect(parsed.hourly_activity_series.data).toHaveLength(24);
    expect(fixture.revenue_series.reduce((sum, row) => sum + row.stars, 0)).toBe(fixture.kpis.revenue_stars.current);
    expect(fixture.users_series.reduce((sum, row) => sum + row.new_users, 0)).toBe(fixture.kpis.new_users.current);
    expect(fixture.kpis.revenue_eur.current).toBeCloseTo(fixture.kpis.revenue_stars.current * 0.02);
    expect(normalizeOverviewData(parsed).revenueSection.totalRevenueStars).toBe(fixture.kpis.revenue_stars.current);
  });
  it("keeps real zero distinct from a missing KPI", () => {
    const zero = normalizeOverviewData(parseOverviewPayloadSections(empty));
    const broken = parseOverviewPayloadSections({ ...empty, kpis: {} });
    expect(zero.revenueSection.totalRevenueStars).toBe(0);
    expect(broken.kpis.data).toBeNull();
    expect(broken.kpis.status).toBe("invalid");
  });
  it("does not turn missing demographic source into an empty source", () => {
    const parsed = parseOverviewPayloadSections({ ...seven, user_age_distribution: undefined });
    expect(parsed.user_age_distribution.status).toBe("invalid");
    expect(parsed.user_age_distribution.data).toBeNull();
  });
  it.each(["revenue_series", "users_series", "hourly_activity_series", "funnel"] as const)("rejects duplicate %s buckets", field => {
    const parsed = parseOverviewPayloadSections({ ...seven, [field]: [seven[field][0], seven[field][0]] });
    expect(parsed[field].status).toBe("invalid");
  });
  it("rejects a fabricated delta without discarding valid sibling metrics", () => {
    const parsed = parseOverviewPayloadSections({ ...seven, kpis: { ...seven.kpis, dau: { current: 4, previous: 2, delta_pct: 0 } } });
    expect(parsed.kpis.status).toBe("partial");
    expect(parsed.kpis.data?.dau).toBeUndefined();
    expect(parsed.kpis.data?.new_users?.current).toBe(2);
  });
});
