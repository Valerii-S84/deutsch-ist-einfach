// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { ANALYTICS_PRODUCT, type AnalyticsEvent } from "../../../lib/analytics/contract";
import { syntheticEvent, TEST_VISITOR } from "../../../lib/analytics/fixtures.test-support";

const { postgresMock } = vi.hoisted(() => ({ postgresMock: vi.fn() }));

vi.mock("postgres", () => ({ default: postgresMock }));

import { cleanRetention, deleteVisitor, insertEvents, openAnalyticsDatabase, type AnalyticsDatabase } from "./database";

const isTemplateCall = (value: unknown): value is TemplateStringsArray => Array.isArray(value) && "raw" in value;

describe("analytics database maintenance helpers", () => {
  it("only opens the dedicated analytics database target", () => {
    expect(() => openAnalyticsDatabase("")).toThrow("analytics_database_not_configured");
    expect(() => openAnalyticsDatabase("http://analytics_user@localhost/deutschmit_analytics")).toThrow("invalid_analytics_database_target");
    expect(() => openAnalyticsDatabase("postgresql://site_user@localhost/deutschmit_analytics")).toThrow("invalid_analytics_database_target");
    expect(() => openAnalyticsDatabase("postgresql://analytics_user@localhost/site")).toThrow("invalid_analytics_database_target");

    const client = { end: vi.fn() };
    postgresMock.mockReturnValueOnce(client);

    expect(openAnalyticsDatabase("postgresql://analytics_user:secret@127.0.0.1:45446/deutschmit_analytics")).toBe(client);
    expect(postgresMock).toHaveBeenCalledWith(
      "postgresql://analytics_user:secret@127.0.0.1:45446/deutschmit_analytics",
      expect.objectContaining({
        max: 5,
        connect_timeout: 2,
        idle_timeout: 20,
        connection: expect.objectContaining({
          application_name: "deutschmit-analytics",
          statement_timeout: 3000,
          lock_timeout: 2000,
        }),
        onnotice: expect.any(Function),
      }),
    );
  });

  it("inserts accepted events in one transaction and reports duplicates", async () => {
    const first = syntheticEvent("page_view") as AnalyticsEvent;
    const second = { ...first, event_id: "33333333-3333-4333-8333-333333333333", sequence: 2 };
    const tx = vi.fn((firstArg: unknown) => isTemplateCall(firstArg) ? [{ event_id: first.event_id }] : { rows: firstArg });
    const sql = Object.assign(vi.fn(), {
      json: vi.fn((value: unknown) => ({ serialized: value })),
      begin: vi.fn(async (callback: (tx: typeof tx) => unknown) => callback(tx)),
    }) as unknown as AnalyticsDatabase;

    await expect(insertEvents(sql, [first, second], "browser")).resolves.toEqual({ accepted: 2, inserted: 1, duplicates: 1 });

    const bulkCall = tx.mock.calls.find(([firstArg]) => !isTemplateCall(firstArg));
    expect(bulkCall?.[0]).toEqual([
      expect.objectContaining({ event_id: first.event_id, source: "browser", metadata: { serialized: first.metadata } }),
      expect.objectContaining({ event_id: second.event_id, source: "browser", metadata: { serialized: second.metadata } }),
    ]);
    expect(bulkCall?.slice(1)).toContain("metadata");
    expect(sql.begin).toHaveBeenCalledTimes(1);
  });

  it("sums retention cleanup across website and shorts products", async () => {
    const sql = vi.fn()
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 3 }) as unknown as AnalyticsDatabase;

    await expect(cleanRetention(sql)).resolves.toEqual({ deleted: 5 });
  });

  it("deletes a visitor only for the analytics product", async () => {
    const sql = vi.fn().mockResolvedValueOnce({ count: 4 }) as unknown as AnalyticsDatabase;

    await expect(deleteVisitor(sql, "quiz-arena", TEST_VISITOR)).rejects.toThrow("invalid_product");
    await expect(deleteVisitor(sql, ANALYTICS_PRODUCT, TEST_VISITOR.toUpperCase())).resolves.toEqual({ deleted: 4 });
    expect(vi.mocked(sql).mock.calls[0][1]).toBe(ANALYTICS_PRODUCT);
    expect(vi.mocked(sql).mock.calls[0][2]).toBe(TEST_VISITOR.toLowerCase());
  });
});
