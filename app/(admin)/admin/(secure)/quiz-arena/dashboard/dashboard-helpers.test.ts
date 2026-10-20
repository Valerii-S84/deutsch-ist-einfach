import { describe, expect, it } from "vitest";

import {
  deltaClassName,
  findPeakHourlyActivity,
  formatDelta,
  formatHourLabel,
  formatHourRangeLabel,
  formatShortDateLabel,
  formatValue,
  mapAlert,
  mapFunnelStep,
  mapProductLabel,
} from "./dashboard-helpers";

describe("dashboard helper formatting", () => {
  it("formats metric values, deltas and calendar labels for dashboard cards", () => {
    expect(formatValue(12.345, "percent")).toBe("12,3 %");
    expect(formatValue(1234, "eur")).toContain("EUR");
    expect(formatValue(1234, "stars")).toBe("1 234 ⭐");
    expect(formatValue(1234, "count")).toBe("1 234");
    expect(formatDelta(3.25)).toBe("+3,3 %");
    expect(formatDelta(0)).toBe("0 %");
    expect(deltaClassName(1)).toContain("emerald");
    expect(deltaClassName(-1)).toContain("red");
    expect(deltaClassName(0)).toContain("ember");
    expect(formatHourLabel(7)).toBe("07:00");
    expect(formatHourRangeLabel(23)).toBe("23:00-00:00");
    expect(formatShortDateLabel("2026-09-14T12:00:00Z")).toMatch(/\d{2}\.\d{2}/);
  });

  it("maps known and fallback labels without hiding unknown backend values", () => {
    expect(mapProductLabel("ENERGY_10")).toBe("Енергія +10");
    expect(mapProductLabel("CUSTOM_PACK")).toBe("CUSTOM_PACK");
    expect(mapFunnelStep("First Quiz")).toBe("Перша вікторина");
    expect(mapFunnelStep("Custom Step")).toBe("Custom Step");
  });

  it("turns typed alerts into owner-facing action text and preserves unknown alerts", () => {
    expect(mapAlert({ type: "webhook_errors", severity: "high", count: 2 })).toMatchObject({
      title: "Telegram/Webhook-Fehler",
      details: "2 Fehler in den letzten 24 Stunden erkannt.",
    });
    expect(mapAlert({ type: "conversion_drop", severity: "medium", from: 12, to: 8 })).toMatchObject({
      title: "Kauf-Konversion gesunken",
      details: "Von 12% auf 8% gefallen.",
    });
    expect(mapAlert({ type: "suspicious_activity", severity: "medium", invalid_promo_attempts_1h: 7 })).toMatchObject({
      title: "Auffällige Promo-Aktivität",
      details: "7 ungültige Promo-Versuche in 1 Stunde.",
    });
    expect(mapAlert({ type: "custom_backend_signal", severity: "low" })).toMatchObject({
      title: "custom_backend_signal",
      details: "Es liegt ein Hinweis vor.",
    });
  });

  it("finds only positive peak activity and keeps empty or zero series distinct", () => {
    expect(findPeakHourlyActivity(undefined)).toBeNull();
    expect(findPeakHourlyActivity([])).toBeNull();
    expect(findPeakHourlyActivity([{ hour: 1, active_users: 0 }])).toBeNull();
    expect(findPeakHourlyActivity([{ hour: 1, active_users: 2 }, { hour: 2, active_users: 5 }, { hour: 3, active_users: 4 }]))
      .toEqual({ hour: 2, active_users: 5 });
  });
});
