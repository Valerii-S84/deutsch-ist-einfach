import { describe, expect, it, vi } from "vitest";

import {
  buildBulkPromoPayload,
  buildCreatePromoPayload,
  buildPatchPromoPayload,
  createBulkPromoForm,
  createEmptyPromoForm,
  createRandomPromoCode,
  fromLocalInput,
  toLocalInput,
} from "./promo-form";
import type { PromoItem } from "./promo-types";
import {
  createEditPromoFormValues,
  formatPromoDateTime,
  formatPromoDiscount,
  formatPromoProducts,
  formatPromoUsage,
  promoStatusClass,
  promoStatusLabel,
  promoStatusTotalLabel,
} from "./promo-view-model";

describe("promo form state", () => {
  it("builds create payload with trimmed code and open-ended validity", () => {
    const values = {
      ...createEmptyPromoForm(),
      code: " sommer2026 ",
      campaignName: " Sommer Aktion ",
      discountType: "FREE" as const,
      applicableProducts: ["worklog"],
      validFrom: "2026-05-01T10:30",
      openEnded: true,
      maxTotalUses: "0",
      maxPerUser: "3",
    };

    expect(buildCreatePromoPayload(values)).toEqual({
      code: "SOMMER2026",
      campaign_name: "Sommer Aktion",
      discount_type: "FREE",
      discount_value: null,
      applicable_products: ["worklog"],
      valid_from: new Date("2026-05-01T10:30").toISOString(),
      valid_until: null,
      max_total_uses: 0,
      max_per_user: 3,
    });
  });

  it("builds bulk payload with normalized prefix and numeric count", () => {
    const values = {
      ...createBulkPromoForm(),
      campaignName: "Frühjahr",
      discountType: "PERCENT" as const,
      discountValue: "15",
      validFrom: "2026-04-15T08:45",
      openEnded: false,
      validUntil: "2026-04-30T23:59",
      count: "250",
      prefix: " ab12 ",
    };

    expect(buildBulkPromoPayload(values)).toEqual({
      campaign_name: "Frühjahr",
      discount_type: "PERCENT",
      discount_value: 15,
      applicable_products: null,
      valid_from: new Date("2026-04-15T08:45").toISOString(),
      valid_until: new Date("2026-04-30T23:59").toISOString(),
      max_total_uses: 0,
      max_per_user: 1,
      count: 250,
      prefix: "AB12",
    });
  });

  it("keeps blank optional create fields explicit while preserving fixed validity windows", () => {
    const values = {
      ...createEmptyPromoForm(),
      code: " fixed25 ",
      campaignName: "   ",
      discountType: "FIXED" as const,
      discountValue: "25",
      validFrom: "",
      openEnded: false,
      validUntil: "2026-06-01T12:00",
      maxTotalUses: "",
      maxPerUser: "",
    };

    expect(buildCreatePromoPayload(values)).toEqual({
      code: "FIXED25",
      campaign_name: null,
      discount_type: "FIXED",
      discount_value: 25,
      applicable_products: null,
      valid_from: null,
      valid_until: new Date("2026-06-01T12:00").toISOString(),
      max_total_uses: 0,
      max_per_user: 1,
    });
  });

  it("normalizes patch and bulk defaults without leaking empty strings to the API", () => {
    const freePatch = {
      ...createEmptyPromoForm(),
      campaignName: "   ",
      discountType: "FREE" as const,
      discountValue: "99",
      openEnded: false,
      validUntil: "",
      maxTotalUses: "",
      maxPerUser: "",
    };
    const blankBulk = {
      ...freePatch,
      count: "",
      prefix: "   ",
    };

    expect(buildPatchPromoPayload(freePatch)).toMatchObject({
      campaign_name: null,
      discount_type: "FREE",
      discount_value: null,
      valid_from: null,
      valid_until: null,
      max_total_uses: 0,
      max_per_user: 1,
    });
    expect(buildBulkPromoPayload(blankBulk)).toMatchObject({ count: 1, prefix: null });
  });

  it("round-trips local date helpers and generates codes from the allowed alphabet", () => {
    expect(toLocalInput(null)).toBe("");
    expect(fromLocalInput("")).toBeNull();
    expect(fromLocalInput(toLocalInput("2026-07-15T08:30:00.000Z"))).toBe(
      "2026-07-15T08:30:00.000Z",
    );

    const randomSpy = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999)
      .mockReturnValue(0.5);

    expect(createRandomPromoCode()).toMatch(/^[A-Z2-9]{8}$/);
    expect(randomSpy).toHaveBeenCalledTimes(8);
    randomSpy.mockRestore();
  });

  it("maps promo detail into edit form defaults", () => {
    const item: PromoItem = {
      id: 17,
      code: "ABCD****",
      code_prefix: "ABCD",
      raw_code: null,
      can_reveal_code: false,
      campaign_name: "Herbst",
      discount_type: "PERCENT",
      discount_value: 20,
      applicable_products: ["worklog"],
      valid_from: "2026-09-01T09:00:00.000Z",
      valid_until: null,
      max_total_uses: 50,
      max_per_user: 2,
      used_total: 0,
      status: "active",
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    };

    expect(createEditPromoFormValues(item)).toMatchObject({
      campaignName: "Herbst",
      discountType: "PERCENT",
      discountValue: "20",
      applicableProducts: ["worklog"],
      openEnded: true,
      maxTotalUses: "50",
      maxPerUser: "2",
      count: "25",
      prefix: "",
    });
  });

  it("formats promo list and detail labels without losing fallback states", () => {
    expect(formatPromoDateTime(null)).toBe("Ohne Enddatum");
    expect(formatPromoDateTime("2026-09-14T10:00:00Z")).not.toBe("Ohne Enddatum");
    expect(formatPromoProducts(null, [{ id: "worklog", title: "Worklog", product_type: "WORKLOG", stars_amount: 100 }])).toBe("Alle Produkte");
    expect(formatPromoProducts([], [{ id: "worklog", title: "Worklog", product_type: "WORKLOG", stars_amount: 100 }])).toBe("Alle Produkte");
    expect(formatPromoProducts(["worklog", "unknown"], [{ id: "worklog", title: "Worklog", product_type: "WORKLOG", stars_amount: 100 }])).toBe("Worklog, unknown");
    expect(formatPromoDiscount({ discount_type: "FREE", discount_value: null })).toBe("Kostenlos");
    expect(formatPromoDiscount({ discount_type: "FIXED", discount_value: 25 })).toBe("25⭐ Festbetrag");
    expect(formatPromoDiscount({ discount_type: "PERCENT", discount_value: null })).toBe("0% Rabatt");
    expect(formatPromoDiscount({ discount_type: "PREMIUM_DAYS", discount_value: 14 })).toBe("Premium-Gutschrift");
    expect(formatPromoUsage({ used_total: 3, max_total_uses: 0 })).toBe("3 / unbegrenzt");
    expect(formatPromoUsage({ used_total: 3, max_total_uses: 10 })).toBe("3 / 10");
    expect(promoStatusLabel("active")).toBe("Aktiv");
    expect(promoStatusLabel("inactive")).toBe("Inaktiv");
    expect(promoStatusLabel("expired")).toBe("Abgelaufen");
    expect(promoStatusClass("active")).toContain("emerald");
    expect(promoStatusClass("inactive")).toContain("amber");
    expect(promoStatusClass("expired")).toContain("slate");
    expect(promoStatusTotalLabel("APPLIED")).toBe("Eingelöst");
    expect(promoStatusTotalLabel("RESERVED")).toBe("Reserviert");
    expect(promoStatusTotalLabel("EXPIRED")).toBe("Abgelaufen");
    expect(promoStatusTotalLabel("REVOKED")).toBe("Widerrufen");
    expect(promoStatusTotalLabel("CUSTOM")).toBe("CUSTOM");
  });
});
