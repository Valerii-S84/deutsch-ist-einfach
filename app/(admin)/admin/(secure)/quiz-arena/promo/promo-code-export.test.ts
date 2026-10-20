import { describe, expect, it, vi } from "vitest";
import {
  copyPromoCodes,
  createBulkCodeModalState,
  createSingleCodeModalState,
  downloadPromoCodesCsv,
  serializePromoCodesCsv,
} from "./promo-code-export";
import type { BulkGenerateResponse, PromoItem } from "./promo-types";

function promoItem(overrides: Partial<PromoItem> = {}): PromoItem {
  return {
    id: 1,
    code: "MASKED****",
    code_prefix: "MASKED",
    raw_code: null,
    can_reveal_code: false,
    campaign_name: "Winter",
    discount_type: "PERCENT",
    discount_value: 15,
    applicable_products: null,
    valid_from: "2026-12-01T00:00:00.000Z",
    valid_until: null,
    max_total_uses: 0,
    max_per_user: 1,
    used_total: 0,
    status: "active",
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("promo CSV export", () => {
  it("preserves commas, quotes, line breaks and neutralizes formulas", () => {
    const csv = serializePromoCodesCsv([{ code: "CODE", campaign_name: '=A1,"test"\nnext', discount_type: "PERCENT", discount_value: 0, valid_until: null }]);
    expect(csv).toBe('code,campaign_name,discount_type,discount_value,valid_until\r\n"CODE","\'=A1,""test""\nnext","PERCENT","0",""');
  });
  it("exports a header for an empty explicit result", () => {
    expect(serializePromoCodesCsv([])).toBe("code,campaign_name,discount_type,discount_value,valid_until");
  });

  it("builds modal state only with revealable raw codes for single code views", () => {
    const hidden = promoItem();
    const revealed = promoItem({ id: 2, raw_code: "FULLCODE", can_reveal_code: true });

    expect(createSingleCodeModalState(hidden)).toEqual({
      title: "Code sichern",
      campaignName: "Winter",
      codes: [],
      csvRows: [],
    });
    expect(createSingleCodeModalState(revealed)).toMatchObject({
      codes: ["FULLCODE"],
      csvRows: [{ code: "FULLCODE", campaign_name: "Winter" }],
    });
  });

  it("uses generated fallback codes only when bulk items do not include raw codes", () => {
    const response: BulkGenerateResponse = {
      generated: 2,
      codes: ["FALLBACK1", "FALLBACK2"],
      items: [
        promoItem({ id: 1, raw_code: "RAW1", can_reveal_code: true }),
        promoItem({ id: 2, code: "MASKED2****", code_prefix: "MASKED2" }),
      ],
    };

    expect(createBulkCodeModalState("Winter", response)).toMatchObject({
      title: "2 Codes wurden erzeugt",
      campaignName: "Winter",
      codes: ["FALLBACK1", "FALLBACK2"],
      csvRows: [{ code: "RAW1" }, { code: "FALLBACK2" }],
    });
  });

  it("copies and downloads the exact serialized CSV payload", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const click = vi.fn();
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:promo");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const createElement = vi.spyOn(document, "createElement").mockReturnValue({
      click,
      href: "",
      download: "",
    } as unknown as HTMLAnchorElement);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

    await copyPromoCodes("CODE1\nCODE2");
    downloadPromoCodesCsv([
      { code: "CODE1", campaign_name: "Winter", discount_type: null, discount_value: null, valid_until: null },
    ]);

    expect(writeText).toHaveBeenCalledWith("CODE1\nCODE2");
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:promo");

    createElement.mockRestore();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    vi.unstubAllGlobals();
  });
});
