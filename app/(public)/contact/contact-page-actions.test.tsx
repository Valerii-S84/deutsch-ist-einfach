/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContactPageActions } from "./contact-page-actions";

const trackEventSpy = vi.fn();

vi.mock("@/app/analytics-provider", () => ({
  usePublicAnalytics: () => ({ trackEvent: trackEventSpy }),
}));

vi.mock("../_components/contact-wizards", () => ({
  ContactWizardModal: ({
    kind,
    isOpen,
    onClose,
  }: {
    kind: string;
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-open-wizard={kind}>
        <button type="button" onClick={onClose}>
          Testdialog schließen
        </button>
      </div>
    ) : null,
}));

function renderActions() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ContactPageActions />);
  });

  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  trackEventSpy.mockClear();
});

describe("contact page actions", () => {
  it("explains Lernbegleitung before the student CTA", () => {
    const { container, cleanup } = renderActions();

    try {
      const text = container.textContent ?? "";
      expect(text).toContain("Lernbegleitung ist zunächst eine unverbindliche Anfrage");
      expect(text).toContain("buchst du keinen Unterricht");
      expect(text.indexOf("Was bedeutet Lernbegleitung?")).toBeLessThan(
        text.indexOf("Unverbindliche Lernanfrage starten"),
      );
    } finally {
      cleanup();
    }
  });

  it("opens both request wizards without a duplicate form_open producer", () => {
    const { container, cleanup } = renderActions();

    try {
      const buttons = Array.from(container.querySelectorAll("button"));
      const studentButton = buttons.find((button) =>
        button.textContent?.includes("Lernanfrage starten"),
      );
      const partnerButton = buttons.find((button) =>
        button.textContent?.includes("Kooperationsanfrage starten"),
      );

      act(() => studentButton?.click());
      expect(container.querySelector('[data-open-wizard="student"]')).not.toBeNull();
      expect(trackEventSpy).not.toHaveBeenCalled();

      const closeButton = Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Testdialog schließen"),
      );
      act(() => closeButton?.click());
      act(() => partnerButton?.click());

      expect(container.querySelector('[data-open-wizard="partner"]')).not.toBeNull();
      expect(trackEventSpy).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });
});
