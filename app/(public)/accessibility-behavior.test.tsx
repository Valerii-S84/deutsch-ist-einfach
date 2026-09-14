/* @vitest-environment jsdom */

import { type ReactElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminLoginPage from "../(admin)/admin/login/page";
import { StudentWizard } from "./_components/contact-wizard-student";
import { PartnerWizard } from "./_components/contact-wizard-partner";
import type { PublicAnalyticsPayload } from "@/lib/analytics";
import { submitContactRequest } from "@/lib/contact/contact-client";

vi.mock("@/lib/contact/contact-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/contact/contact-client")>(),
  submitContactRequest: vi.fn(),
}));

const trackEventSpy = vi.fn();
const submissionContext = {
  consent: "granted", schema_version: 1, visitor_id: "11111111-1111-4111-8111-111111111111",
  session_id: "22222222-2222-4222-8222-222222222222", page_view_id: "33333333-3333-4333-8333-333333333333",
  path: "/contact", form_instance_id: "44444444-4444-4444-8444-444444444444", submission_attempt_id: "55555555-5555-4555-8555-555555555555",
};

vi.mock("@/app/analytics-provider", () => ({
  usePublicAnalytics: () => ({
    consent: "granted",
    prepareFormSubmission: async (form: string) => ({ ...submissionContext, form_id: form }),
    requestConsent: vi.fn(),
    trackEvent: (name: string, payload: PublicAnalyticsPayload) => trackEventSpy(name, payload),
  }),
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
  await clickOptionByFieldsetIndexAndFlush(container, "student-age-group", 0);
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
  trackEventSpy.mockClear();
});

describe("student wizard a11y behavior", () => {
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
  it("submits student with separate context and no client success event", async () => {
    vi.mocked(submitContactRequest).mockResolvedValueOnce(undefined);
    const { container, cleanup } = renderInContainer(<StudentWizard onClose={vi.fn()} />);

    try {
      await fillRequiredStudentFields(container);
      await clickByTextAndFlush(container, "Anfrage senden →");

      expect(submitContactRequest).toHaveBeenCalledWith({
        type: "student",
        name: "Anna Test",
        ageGroup: "unter_16",
        level: "A1",
        goals: ["alltag"],
        format: "individual",
        timeSlots: ["morning"],
        frequency: "once",
        budget: "",
        contact: "anna@example.com",
        message: "",
        company: "",
      }, { ...submissionContext, form_id: "student" });
      expect(container.textContent).toContain("Danke, Anna Test!");
      expect(trackEventSpy).toHaveBeenCalledWith("wizard_open", { wizard_type: "student" });
      expect(trackEventSpy.mock.calls.some(([name]) => name === "lead_submit_success")).toBe(false);
      expect(JSON.stringify(trackEventSpy.mock.calls)).not.toContain("@" );
    } finally {
      cleanup();
    }
  });

  it("submits partner with separate context and no client success event", async () => {
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
      }, { ...submissionContext, form_id: "partner" });
      expect(container.textContent).toContain("Danke für euren Vorschlag!");
      expect(trackEventSpy).toHaveBeenCalledWith("wizard_open", { wizard_type: "partner" });
      expect(trackEventSpy.mock.calls.some(([name]) => name === "lead_submit_success")).toBe(false);
      expect(JSON.stringify(trackEventSpy.mock.calls)).not.toContain("@" );
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
      expect(trackEventSpy).toHaveBeenCalledWith("form_error", expect.objectContaining({ form_id: "student", error_code: "unknown_error", submission_attempt_id: submissionContext.submission_attempt_id }));
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
