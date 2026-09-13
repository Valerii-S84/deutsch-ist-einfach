import { describe, expect, it } from "vitest";
import { serializePromoCodesCsv } from "./promo-code-export";
describe("promo CSV export", () => {
  it("preserves commas, quotes, line breaks and neutralizes formulas", () => {
    const csv = serializePromoCodesCsv([{ code: "CODE", campaign_name: '=A1,"test"\nnext', discount_type: "PERCENT", discount_value: 0, valid_until: null }]);
    expect(csv).toBe('code,campaign_name,discount_type,discount_value,valid_until\r\n"CODE","\'=A1,""test""\nnext","PERCENT","0",""');
  });
  it("exports a header for an empty explicit result", () => {
    expect(serializePromoCodesCsv([])).toBe("code,campaign_name,discount_type,discount_value,valid_until");
  });
});
