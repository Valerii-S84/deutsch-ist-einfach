import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { api } from "@/lib/quiz-arena-api";
import Layout from "./layout";
import Requests from "./requests/page";
import SiteRequests from "../deutschmit/requests/page";

vi.mock("@/lib/quiz-arena-api", () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock("./quiz-logout", () => ({ QuizLogout: () => null }));
vi.mock("./quiz-arena-provider", () => ({ QuizArenaProvider: ({ children }: { children: ReactNode }) => children }));

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

const item = { id: 7, type: "student", status: "NEW", name: "Synthetic owner request", contact: "test@example.test", payload: { message: "Synthetic details" }, created_at: "2026-09-13T00:00:00Z" };
const data = (status = "NEW") => ({ items: [{ ...item, status }], total: 1, page: 1, pages: 1 });

async function show(page: ReactNode) {
  await act(async () => root.render(<QueryClientProvider client={client}>{page}</QueryClientProvider>));
}
async function until(assertion: () => void) {
  await vi.waitFor(async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    assertion();
  }, { timeout: 2000, interval: 10 });
}
function select(label: string) {
  const element = container.querySelector<HTMLSelectElement>('select[aria-label="' + label + '"]');
  if (!element) throw new Error("Missing select: " + label);
  return element;
}

it("exposes a requests entry while preserving every Quiz Arena section", () => {
  const markup = renderToStaticMarkup(<Layout>Content</Layout>);
  for (const section of ["dashboard", "users", "content", "economy", "promo", "system", "login", "requests"]) {
    expect(markup).toContain('href="/admin/quiz-arena/' + section + '"');
  }
});
it("opens only the Quiz archive and confirms a status update through a list readback", async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ data: data() }).mockResolvedValue({ data: data("DONE") });
  vi.mocked(api.post).mockResolvedValue({ data: { id: 7, status: "DONE" } });
  const siteFetch = vi.fn(); vi.stubGlobal("fetch", siteFetch);
  await show(<Requests />);
  await until(() => expect(container.textContent).toContain("Synthetic owner request · test@example.test"));
  expect(select("Джерело заявок").value).toBe("legacy");
  expect(select("Джерело заявок").disabled).toBe(true);
  expect(api.get).toHaveBeenCalledWith("/admin/contact-requests", { params: { page: 1, limit: 20 } });
  await act(async () => {
    const status = select("Статус заявки 7");
    status.value = "DONE";
    status.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await until(() => {
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(select("Статус заявки 7").value).toBe("DONE");
    expect(container.textContent).toContain("Статус збережено; список оновлено.");
  });
  expect(api.post).toHaveBeenCalledWith("/admin/contact-requests/7/status", { status: "DONE" });
  expect(siteFetch).not.toHaveBeenCalled();
});
it("shows unavailable archive data as an error, without an invented zero", async () => {
  vi.mocked(api.get).mockRejectedValue(new Error("Synthetic outage"));
  await show(<Requests />);
  await until(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain("Джерело недоступне"));
  expect(container.textContent).not.toContain("Усього в цьому джерелі: 0");
});
it("keeps the existing Website requests page on the separate site source", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(data()));
  vi.stubGlobal("fetch", fetchMock);
  await show(<SiteRequests />);
  await until(() => expect(container.textContent).toContain("Synthetic owner request · test@example.test"));
  expect(select("Джерело заявок").value).toBe("site");
  expect(fetchMock).toHaveBeenCalledWith("/api/admin/contact-requests?page=1&scope=production", expect.any(Object));
  expect(api.get).not.toHaveBeenCalled();
});
