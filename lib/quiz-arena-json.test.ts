import { describe, expect, it } from "vitest";
import { parseQuizJson } from "./quiz-arena-json";
describe("Quiz Arena bigint identifiers", () => {
  it("preserves two adjacent IDs above JS precision instead of targeting another promo", () => {
    expect(parseQuizJson('[{"id":9223372036854775806},{"id":9223372036854775807}]')).toEqual([{ id: "9223372036854775806" }, { id: "9223372036854775807" }]);
  });
  it("does not transform text, escaped quotes, decimals or safe counts", () => {
    const expected = { code: 'id 9223372036854775807 "quoted"', count: 0, amount: 0.02, exp: 1e-5 };
    expect(parseQuizJson(JSON.stringify(expected))).toEqual(expected);
  });
});
