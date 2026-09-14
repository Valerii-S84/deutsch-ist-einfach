import { describe, expect, it } from "vitest";
import { shortsBatchSchema, shortsEventSchema } from "./shorts-contract";
const event = {
  event_id: "d8b19e89-bb5e-4a0b-a4b4-f6a3c01d68d7", visitor_id: "0af1b51e-7e9c-4e27-87a7-c5b192afdd89",
  session_id: "0dbb2687-6c58-4f12-9d2e-52497c1ba9bd", page_view_id: "1c0a42ad-7e6b-49e9-8d37-5fe24cc07e69",
  event_name: "page_view", occurred_at: "2026-09-14T12:00:00.000Z", sequence: 1, path: "/",
  element_id: null, active_ms: null, referrer_host: "example.org", device: "desktop", is_test: false,
};
describe("Shorts browser event contract", () => {
  it("accepts a page view with anonymous identifiers", () => expect(shortsEventSchema.parse(event)).toEqual(event));
  it("rejects another product, query strings, arbitrary actions and extra private fields", () => {
    for (const change of [{ product_id: "deutschmit" }, { path: "/?email=person@example.org" }, { element_id: "buy", event_name: "element_click" }, { ip: "192.0.2.1" }, { referrer_host: "https://example.org/private" }]) {
      expect(shortsEventSchema.safeParse({ ...event, ...change }).success).toBe(false);
    }
  });
  it("requires click and duration fields only on matching events", () => {
    expect(shortsEventSchema.safeParse({ ...event, event_name: "element_click" }).success).toBe(false);
    expect(shortsEventSchema.safeParse({ ...event, event_name: "element_click", element_id: "support" }).success).toBe(true);
    expect(shortsEventSchema.safeParse({ ...event, event_name: "page_leave", active_ms: 3500 }).success).toBe(true);
    expect(shortsEventSchema.safeParse({ ...event, active_ms: 3500 }).success).toBe(false);
  });
  it("bounds batch size and activity duration", () => {
    expect(shortsBatchSchema.safeParse({ events: Array(21).fill(event) }).success).toBe(false);
    expect(shortsEventSchema.safeParse({ ...event, event_name: "page_leave", active_ms: -1 }).success).toBe(false);
  });
});
