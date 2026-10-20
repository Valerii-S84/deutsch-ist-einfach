import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminLoginPage from "./page";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function changeInput(id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function submit() {
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

async function renderLogin() {
  await act(async () => root.render(<AdminLoginPage />));
}

async function expectAlert(text: string) {
  await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain(text));
}

describe("admin login page", () => {
  it.each([
    [429, "Занадто багато спроб входу"],
    [403, "Спроба входу блокована захистом безпеки"],
    [503, "Вхід адміністратора тимчасово недоступний"],
    [401, "Не вдалося увійти"],
  ])("maps failed login status %i to a safe Ukrainian message", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
    await renderLogin();
    await act(async () => {
      changeInput("admin-email", "owner@example.test");
      changeInput("admin-password", "secret1");
    });
    await submit();
    await expectAlert(message);
    expect(fetch).toHaveBeenCalledWith("/api/admin/login", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
    }));
  });

  it("focuses field validation errors before making a login request", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await renderLogin();
    await submit();
    await vi.waitFor(() => expect(container.textContent).toContain("Введіть коректну електронну адресу"));
    expect(document.activeElement?.id).toBe("admin-email");
    expect(fetch).not.toHaveBeenCalled();

    await act(async () => changeInput("admin-email", "owner@example.test"));
    await submit();
    await vi.waitFor(() => expect(container.textContent).toContain("Пароль має містити"));
    expect(document.activeElement?.id).toBe("admin-password");
  });

  it("reports network failures without leaking error details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private stack")));
    await renderLogin();
    await act(async () => {
      changeInput("admin-email", "owner@example.test");
      changeInput("admin-password", "secret1");
    });
    await submit();
    await expectAlert("Мережеві проблеми");
    expect(container.textContent).not.toContain("private stack");
  });
});
