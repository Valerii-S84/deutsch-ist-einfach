"use client";

import { type ReactNode, useEffect, useState } from "react";
import dynamic from "next/dynamic";

import { usePublicAnalytics } from "@/app/analytics-provider";
import type { ActiveWizard } from "./public-home-types";

const ContactWizardModal = dynamic(
  async () => {
    const mod = await import("./_components/contact-wizards");
    return { default: mod.ContactWizardModal };
  },
  {
    ssr: false,
    loading: () => null,
  },
);

type PublicHomeClientProps = {
  children?: ReactNode;
};

export default function PublicHomeClient({ children }: PublicHomeClientProps) {
  const [activeWizard, setActiveWizard] = useState<ActiveWizard>(null);
  const { trackEvent } = usePublicAnalytics();

  useEffect(() => {
    const root = document.getElementById("public-home-root");
    if (!root) {
      return;
    }

    const onRootClick = (event: MouseEvent) => {
      const analyticsTarget = (event.target as HTMLElement | null)?.closest?.(
        '[data-analytics-event="hero_cta_click"], [data-analytics-event="channel_cta_click"]',
      );

      if (analyticsTarget) {
        const eventName = analyticsTarget.getAttribute("data-analytics-event");

        if (eventName === "hero_cta_click" || eventName === "channel_cta_click") {
          trackEvent(eventName, {
            section: analyticsTarget.getAttribute("data-analytics-section") || undefined,
            cta: analyticsTarget.getAttribute("data-analytics-cta") || undefined,

          });
        }
      }

      const wizardButton = (event.target as HTMLElement | null)?.closest?.(
        '[data-wizard="student"], [data-wizard="partner"]',
      );
      const wizardType = wizardButton?.getAttribute("data-wizard");

      if (!wizardButton || (wizardType !== "student" && wizardType !== "partner")) {
        return;
      }


      setActiveWizard(wizardType);
    };

    root.addEventListener("click", onRootClick);
    return () => root.removeEventListener("click", onRootClick);
  }, [trackEvent]);

  return (
    <>
      {children}
      <ContactWizardModal
        kind="student"
        isOpen={activeWizard === "student"}
        onClose={() => setActiveWizard(null)}
      />
      <ContactWizardModal
        kind="partner"
        isOpen={activeWizard === "partner"}
        onClose={() => setActiveWizard(null)}
      />
    </>
  );
}
