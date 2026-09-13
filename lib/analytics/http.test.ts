// @vitest-environment node
import { expect, it } from "vitest";
import { MAX_BATCH_BYTES } from "./contract";
import { readAnalyticsJson } from "./http";

it("limits streamed bytes without Content-Length and accepts the exact boundary", async () => {
  const request = (size: number) => new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: '"' + "a".repeat(size - 2) + '"' });
  expect((await readAnalyticsJson(request(MAX_BATCH_BYTES)) as string).length).toBe(MAX_BATCH_BYTES - 2);
  await expect(readAnalyticsJson(request(MAX_BATCH_BYTES + 1))).rejects.toMatchObject({ status: 413 });
  await expect(readAnalyticsJson(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": "33000" }, body: "{}" }))).rejects.toMatchObject({ status: 413 });
});
it("rejects malformed JSON, media types and compression", async () => {
  await expect(readAnalyticsJson(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).rejects.toMatchObject({ status: 400 });
  await expect(readAnalyticsJson(new Request("http://localhost", { method: "POST", body: "{}" }))).rejects.toMatchObject({ status: 415 });
  await expect(readAnalyticsJson(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" }, body: "{}" }))).rejects.toMatchObject({ status: 415 });
});
