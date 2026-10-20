import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/quiz-arena-api";
import { UserDetail } from "./user-detail";

vi.mock("@/lib/quiz-arena-api", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const activeProfile = {
  info: { id: 42, telegram_user_id: 4242, username: "anna", first_name: "Anna", language: "de", status: "ACTIVE", created_at: "2026-09-01T00:00:00Z", last_seen_at: "2026-09-14T08:00:00Z" },
  progress: { levels: [{ mode: "daily", level: "B1" }], streak: 5, best_streak: 12, paid_energy: 7 },
  purchases: [{ id: "pay_1", product: "PREMIUM_MONTH", stars: 100, status: "CREDITED", paid_at: null }],
  referrals: [{ id: 1, referrer_user_id: 42, referred_user_id: 43, status: "confirmed", created_at: "2026-09-02T00:00:00Z" }],
  timeline: [{ type: "bonus_granted", created_at: "2026-09-14T09:00:00Z", payload: { amount: 7 } }],
};
const blockedProfile = { ...activeProfile, info: { ...activeProfile.info, status: "BLOCKED" } };

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

async function show(onClose = vi.fn()) {
  await act(async () => root.render(<QueryClientProvider client={client}><UserDetail userId={42} onClose={onClose} /></QueryClientProvider>));
}

async function until(assertion: () => void) {
  await vi.waitFor(async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    assertion();
  }, { timeout: 2000, interval: 10 });
}

function byText(text: string) {
  const button = [...container.querySelectorAll("button")].find(item => item.textContent === text);
  if (!button) throw new Error(`Missing button ${text}`);
  return button;
}

function changeControl(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}

describe("Quiz Arena user detail controls", () => {
  it("renders verified profile data and confirms block readback before showing success", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: activeProfile }).mockResolvedValueOnce({ data: blockedProfile });
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true } });
    const onClose = vi.fn();

    await show(onClose);
    await until(() => expect(container.textContent).toContain("Anna · @anna · ACTIVE · Telegram 4242"));
    expect(container.textContent).toContain("Streak: 5; найкращий: 12; оплачена енергія: 7");
    expect(container.textContent).toContain("PREMIUM_MONTH · 100 Stars · CREDITED · Немає дати оплати");
    expect(container.textContent).toContain("42 → 43: confirmed");
    expect(container.textContent).toContain("bonus_granted");
    await act(async () => {
      changeControl(container.querySelector<HTMLInputElement>('input[aria-label="Причина блокування"]')!, " abuse ");
    });
    await act(async () => byText("Блокувати").click());
    await until(() => expect(container.textContent).toContain("Backend прийняв дію; профіль перечитано"));
    expect(api.post).toHaveBeenCalledWith("/admin/users/42/block", { reason: "abuse" });

    await act(async () => byText("Закрити").click());
    expect(onClose).toHaveBeenCalled();
  });

  it("guards destructive reset behind confirmation and reports unconfirmed writes", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: activeProfile });
    vi.mocked(api.post).mockResolvedValueOnce({ data: { ok: false } });
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);

    await show();
    await until(() => expect(container.textContent).toContain("Керування"));
    await act(async () => byText("Скинути стан").click());
    expect(confirm).toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();

    await act(async () => {
      const amount = container.querySelector<HTMLInputElement>('input[aria-label="Кількість бонусу"]')!;
      changeControl(amount, "7");
      const bonusType = container.querySelector<HTMLSelectElement>('select[aria-label="Тип бонусу"]')!;
      changeControl(bonusType, "premium_days");
    });
    await act(async () => byText("Надати бонус").click());
    await until(() => expect(container.textContent).toContain("Результат запису не підтверджено"));
    expect(api.post).toHaveBeenCalledWith("/admin/users/42/bonus", { type: "premium_days", amount: 7 });
  });
});
