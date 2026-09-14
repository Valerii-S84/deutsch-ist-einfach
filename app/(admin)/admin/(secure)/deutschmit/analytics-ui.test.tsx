import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { formatDuration, ReportState, SnapshotNotice } from "./analytics-ui";

afterEach(() => vi.useRealTimers());

it("keeps an absent active-time observation separate from measured zero", () => {
  expect(formatDuration(null)).toBe("Немає даних");
  expect(formatDuration(0)).toBe("0 мс");
  expect(formatDuration(60_000)).toBe("1 хв 0 с");
});

it("hides cached counters on an error and distinguishes loading", () => {
  const error = renderToStaticMarkup(<ReportState loading={false} error={new Error("private failure")}><p>42</p></ReportState>);
  expect(error).toContain('role="alert"');
  expect(error).not.toContain("private failure");
  expect(error).not.toContain("42");
  expect(renderToStaticMarkup(<ReportState loading error={null}>42</ReportState>)).toContain("Завантаження");
});

it("marks a mounted snapshot stale after five minutes without a new response", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    act(() => root.render(<SnapshotNotice generatedAt="2026-09-13T10:00:00Z" />));
    act(() => vi.advanceTimersByTime(300_000));
    expect(container.textContent).toBe("");
    act(() => vi.advanceTimersByTime(15_000));
    expect(container.textContent).toContain("старші за 5 хвилин");
    act(() => root.render(<SnapshotNotice generatedAt="2026-09-13T10:05:15Z" />));
    expect(container.textContent).toBe("");
  } finally { act(() => root.unmount()); }
});
