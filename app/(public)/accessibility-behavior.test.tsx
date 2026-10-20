/* @vitest-environment jsdom */

import { type ReactElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminLoginPage from "../(admin)/admin/login/page";
import { StudentWizard } from "./_components/contact-wizard-student";
import { PartnerWizard } from "./_components/contact-wizard-partner";
import { submitContactRequest } from "@/lib/contact/contact-client";

vi.mock("@/lib/contact/contact-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/contact/contact-client")>(),
  submitContactRequest: vi.fn(),
}));

const trackSpy = vi.fn();
vi.mock("@/lib/umami", () => ({
  track: (name: string, data?: Record<string, string | number>) => trackSpy(name, data),
}));

type MountedRoot = {
  container: HTMLDivElement;
  cleanup: () => void;
};

function renderInContainer(ui: ReactElement): MountedRoot {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(ui);
  });

  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function clickByText(container: HTMLElement, expectedText: string): void {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(expectedText),
  );
  if (!button) {
    throw new Error(`Button with text containing "${expectedText}" not found`);
  }

  act(() => {
    button.click();
  });
}

async function clickByTextAndFlush(container: HTMLElement, expectedText: string): Promise<void> {
  clickByText(container, expectedText);
  await flushEffects();
}

function setValueById(container: HTMLElement, id: string, value: string): void {
  const element = container.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!element) {
    throw new Error(`Input with id "${id}" not found`);
  }

  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(element.constructor.prototype, "value")?.set;
    if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  });
}

async function setValueByIdAndFlush(container: HTMLElement, id: string, value: string): Promise<void> {
  setValueById(container, id, value);
  await flushEffects();
}

function clickOptionByText(container: HTMLElement, expectedText: string): void {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(expectedText),
  );
  if (!button) {
    throw new Error(`Option button with text containing "${expectedText}" not found`);
  }

  act(() => {
    button.click();
  });
}

async function clickOptionByTextAndFlush(container: HTMLElement, expectedText: string): Promise<void> {
  clickOptionByText(container, expectedText);
  await flushEffects();
}

function clickOptionByFieldsetIndex(
  container: HTMLElement,
  fieldsetId: string,
  optionIndex: number,
): void {
  const fieldset = container.querySelector(`#${fieldsetId}`);
  if (!fieldset) {
    throw new Error(`Fieldset with id "${fieldsetId}" not found`);
  }

  const option = Array.from(fieldset.querySelectorAll("button"))[optionIndex];
  if (!option) {
    throw new Error(`Option ${optionIndex} not found in fieldset "${fieldsetId}"`);
  }

  act(() => {
    option.click();
  });
}

async function clickOptionByFieldsetIndexAndFlush(
  container: HTMLElement,
  fieldsetId: string,
  optionIndex: number,
): Promise<void> {
  clickOptionByFieldsetIndex(container, fieldsetId, optionIndex);
  await flushEffects();
}

async function fillRequiredStudentFields(container: HTMLElement): Promise<void> {
  await setValueByIdAndFlush(container, "student-name", "Anna Test");
  await clickOptionByFieldsetIndexAndFlush(container, "student-level", 0);
  await clickOptionByFieldsetIndexAndFlush(container, "student-goals", 0);
  await clickByTextAndFlush(container, "Weiter");

  await clickOptionByFieldsetIndexAndFlush(container, "student-format", 0);
  await clickOptionByFieldsetIndexAndFlush(container, "student-time", 0);
  await clickOptionByFieldsetIndexAndFlush(container, "student-frequency", 0);
  await clickByTextAndFlush(container, "Weiter");

  await setValueByIdAndFlush(container, "student-contact", "anna@example.com");
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
  trackSpy.mockClear();
});

describe("student wizard a11y behavior", () => {
  it("не показує поле віку у формі студента", () => {
    const { container, cleanup } = renderInContainer(<StudentWizard onClose={vi.fn()} />);

    try {
      expect(container.querySelector("#student-age-group")).toBeNull();
      expect(container.textContent).not.toMatch(/Wie alt bist du|Unter 16|Altersgruppe/);
    } finally {
      cleanup();
    }
  });

  it("moves focus to first invalid field on first step validation failure", async () => {
    const { container, cleanup } = renderInContainer(<StudentWizard onClose={vi.fn()} />);

    try {
      await clickByTextAndFlush(container, "Weiter");

      expect((container.querySelector("#student-form-error")?.textContent ?? "")).toContain(
        "Bitte gib deinen Namen ein.",
      );
      expect(document.activeElement?.id).toBe("student-name");
    } finally {
      cleanup();
    }
  });

});

describe("lead analytics behavior", () => {
  it("submits student without analytics context and tracks success", async () => {
    vi.mocked(submitContactRequest).mockResolvedValueOnce(undefined);
    const { container, cleanup } = renderInContainer(<StudentWizard onClose={vi.fn()} />);

    try {
      await fillRequiredStudentFields(container);
      await clickByTextAndFlush(container, "Anfrage senden →");

      expect(submitContactRequest).toHaveBeenCalledWith({
        type: "student",
        name: "Anna Test",
        level: "A1",
        goals: ["alltag"],
        format: "individual",
        timeSlots: ["morning"],
        frequency: "once",
        budget: "",
        contact: "anna@example.com",
        message: "",
        company: "",
      });
      expect(container.textContent).toContain("Danke, Anna Test!");
      expect(trackSpy).toHaveBeenCalledWith("form-open", { form: "student" });
      expect(trackSpy).toHaveBeenCalledWith("form-success", { form: "student" });
      expect(trackSpy.mock.calls.filter(([name]) => name === "form-open")).toHaveLength(1);
      expect(trackSpy.mock.calls.filter(([name]) => name === "form-success")).toHaveLength(1);
      expect(JSON.stringify(trackSpy.mock.calls)).not.toContain("@" );
    } finally {
      cleanup();
    }
  });

  it("submits partner without analytics context and tracks success", async () => {
    vi.mocked(submitContactRequest).mockResolvedValueOnce(undefined);
    const { container, cleanup } = renderInContainer(<PartnerWizard onClose={vi.fn()} />);

    try {
      await setValueByIdAndFlush(container, "partner-name", "Learn Academy");
      await clickOptionByFieldsetIndexAndFlush(container, "partner-type", 0);
      await setValueByIdAndFlush(container, "partner-country", "Berlin");
      await clickOptionByFieldsetIndexAndFlush(container, "partner-student-count", 0);
      await clickOptionByFieldsetIndexAndFlush(container, "partner-offerings", 0);
      await clickByTextAndFlush(container, "Weiter");

      await setValueByIdAndFlush(container, "partner-contact", "@learn_academy");
      await setValueByIdAndFlush(
        container,
        "partner-idea",
        "Wir möchten Kooperation rund um Prüfungsvorbereitung aufbauen.",
      );
      await clickOptionByTextAndFlush(container, "So schnell wie möglich");
      await clickByTextAndFlush(container, "Vorschlag senden →");

      expect(submitContactRequest).toHaveBeenCalledWith({
        type: "partner",
        name: "Learn Academy",
        partnerType: "tutor",
        country: "Berlin",
        studentCount: "bis_10",
        offerings: ["teaching"],
        contact: "@learn_academy",
        website: "",
        idea: "Wir möchten Kooperation rund um Prüfungsvorbereitung aufbauen.",
        startTimeline: "asap",
        company: "",
      });
      expect(container.textContent).toContain("Danke für euren Vorschlag!");
      expect(trackSpy).toHaveBeenCalledWith("form-open", { form: "partner" });
      expect(trackSpy).toHaveBeenCalledWith("form-success", { form: "partner" });
      expect(trackSpy.mock.calls.filter(([name]) => name === "form-open")).toHaveLength(1);
      expect(trackSpy.mock.calls.filter(([name]) => name === "form-success")).toHaveLength(1);
      expect(JSON.stringify(trackSpy.mock.calls)).not.toContain("@" );
    } finally {
      cleanup();
    }
  });
});

describe("contact submit error behavior", () => {
  it("keeps the student form error UX when the site contact request fails", async () => {
    vi.mocked(submitContactRequest).mockRejectedValueOnce(new Error("Request failed"));
    const { container, cleanup } = renderInContainer(<StudentWizard onClose={vi.fn()} />);

    try {
      await fillRequiredStudentFields(container);
      await clickByTextAndFlush(container, "Anfrage senden →");

      expect(container.textContent).toContain(
        "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
      );
      expect(document.activeElement?.id).toBe("student-form-error");
      expect(trackSpy).toHaveBeenCalledWith("form-error", { form: "student", code: "unknown_error" });
    } finally {
      cleanup();
    }
  });
});

describe("partner wizard a11y behavior", () => {
  it("moves focus to first invalid field when trying to advance", async () => {
    const { container, cleanup } = renderInContainer(<PartnerWizard onClose={vi.fn()} />);

    try {
      await clickByTextAndFlush(container, "Weiter");

      expect((container.querySelector("#partner-form-error")?.textContent ?? "")).toContain(
        "Bitte gib deinen Namen oder den Organisationsnamen ein.",
      );
      expect(document.activeElement?.id).toBe("partner-name");
    } finally {
      cleanup();
    }
  });
});

describe("admin login a11y behavior", () => {
  it("returns focus to admin-email on first RHF validation failure", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { container, cleanup } = renderInContainer(<AdminLoginPage />);

    try {
      clickByText(container, "Увійти");

      await act(async () => {
        await Promise.resolve();
      });

      const email = document.getElementById("admin-email");
      expect(email).not.toBeNull();
      expect(document.activeElement).toBe(email);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      cleanup();
    }
  });
});
