import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";

import ContactRequests from "./contact-requests";

it("показує стару заявку студента з ageGroup без помилки", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
    items: [{
      id: "1689d573-2a28-44c8-a1ff-4c04fbf43c49",
      type: "student",
      status: "NEW",
      name: "Synthetic student",
      contact: "student@example.test",
      payload: { ageGroup: "unter_16", level: "A1", goals: ["alltag"] },
      created_at: "2026-09-13T00:00:00Z",
    }],
    total: 1,
    page: 1,
    pages: 1,
  })));

  try {
    await act(async () => root.render(<QueryClientProvider client={client}><ContactRequests /></QueryClientProvider>));
    await vi.waitFor(async () => {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
      expect(container.querySelector("article")?.textContent).toContain("Synthetic student");
    });

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector("dl")?.textContent).toContain("ageGroupunter_16");
  } finally {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.unstubAllGlobals();
  }
});
