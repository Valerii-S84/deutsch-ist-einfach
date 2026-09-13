"use client";

import { analyticsAttributes } from "@/lib/analytics/elements";
import { useState } from "react";

import { ContactWizardModal } from "../_components/contact-wizards";
import type { WizardKind } from "../_components/contact-wizard-shared";

const BUTTON_CLASS =
  "mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 py-2.5 text-center text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto";

export function ContactPageActions() {
  const [activeWizard, setActiveWizard] = useState<WizardKind | null>(null);

  function openWizard(kind: WizardKind) {

    setActiveWizard(kind);
  }

  return (
    <>
      <section
        id="lernbegleitung"
        aria-labelledby="lernbegleitung-heading"
        className="scroll-mt-28 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]"
      >
        <article className="rounded-[28px] border border-amber-300/20 bg-amber-300/[0.07] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.24)] sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
            Für Deutschlernende
          </p>
          <h2 id="lernbegleitung-heading" className="mt-3 text-3xl font-semibold text-white">
            Was bedeutet Lernbegleitung?
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-300">
            Lernbegleitung ist zunächst eine unverbindliche Anfrage zur Orientierung. Du nennst
            uns dein Deutschniveau, dein Lernziel, dein bevorzugtes Format, deine verfügbaren
            Zeiten und deinen Budgetrahmen. Wir prüfen deine Angaben und melden uns mit einem
            sinnvollen nächsten Schritt.
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-400">
            Mit dem Absenden buchst du keinen Unterricht und gehst keine Verpflichtung ein.
          </p>
          <button
            type="button"
            onClick={() => openWizard("student")}
            {...analyticsAttributes("student_form", "contact")}
            className={`${BUTTON_CLASS} bg-[#FFD166] text-[#07111f] hover:bg-[#ffe099] focus-visible:ring-white`}
          >
            Unverbindliche Lernanfrage starten
          </button>
        </article>

        <article
          aria-labelledby="cooperation-heading"
          className="rounded-[28px] border border-[#4DE2C6]/20 bg-[#4DE2C6]/[0.06] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.24)] sm:p-8"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4DE2C6]">
            Für Lehrkräfte &amp; Organisationen
          </p>
          <h2 id="cooperation-heading" className="mt-3 text-3xl font-semibold text-white">
            Kooperation vorschlagen
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-300">
            Du unterrichtest Deutsch, betreibst eine Lerncommunity oder hast eine Idee für
            gemeinsame Inhalte? Beschreibe kurz dein Angebot und das gewünschte Format. So können
            wir den Vorschlag gezielt prüfen.
          </p>
          <button
            type="button"
            onClick={() => openWizard("partner")}
            {...analyticsAttributes("partner_form", "contact")}
            className={`${BUTTON_CLASS} border border-[#4DE2C6]/30 bg-[#4DE2C6]/10 text-[#B9FFF2] hover:bg-[#4DE2C6]/20 focus-visible:ring-[#B9FFF2]`}
          >
            Kooperationsanfrage starten
          </button>
        </article>
      </section>

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
