"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import type { ContactAnalyticsContext } from "@/lib/analytics/contract";
import { useContactAnalytics } from "./use-contact-analytics";
import { submitContactRequest } from "@/lib/contact/contact-client";
import {
  partnerContactRequestSchema,
  type PartnerOffering,
  type PartnerStartTimeline,
  type PartnerStudentCount,
  type PartnerType,
} from "@/lib/contact/contact-schema";

import {
  ChoiceCards,
  ChoiceOption,
  HoneypotField,
  INPUT_CLASS,
  MultiChoiceCards,
  Spinner,
  StepIndicator,
  SubmitState,
  toggleInList,
  WizardProps,
} from "./contact-wizard-shared";

type PartnerFormState = {
  name: string;
  partnerType: string;
  country: string;
  studentCount: string;
  offerings: string[];
  contact: string;
  website: string;
  idea: string;
  startTimeline: string;
  company: string;
};

type ValidationResult = {
  message: string;
  fieldId: string | null;
};

const PARTNER_ERROR_ID = "partner-form-error";
const PARTNER_NAME_FIELD_ID = "partner-name";
const PARTNER_TYPE_FIELD_ID = "partner-type";
const PARTNER_COUNTRY_FIELD_ID = "partner-country";
const PARTNER_COUNT_FIELD_ID = "partner-student-count";
const PARTNER_OFFERINGS_FIELD_ID = "partner-offerings";
const PARTNER_CONTACT_FIELD_ID = "partner-contact";

const PARTNER_TYPE_OPTIONS = [
  { value: "tutor", label: "Privater Nachhilfelehrer", icon: "👩‍🏫" },
  { value: "school", label: "Sprachschule / Kurse", icon: "🏫" },
  { value: "platform", label: "Online-Plattform", icon: "📱" },
  { value: "creator", label: "Content Creator / Blogger", icon: "🎬" },
  { value: "other_org", label: "Andere Organisation", icon: "🏢" },
] satisfies Array<ChoiceOption & { value: PartnerType }>;

const PARTNER_STUDENT_COUNT_OPTIONS = [
  { value: "bis_10", label: "Bis 10" },
  { value: "10_50", label: "10-50" },
  { value: "50_200", label: "50-200" },
  { value: "200_plus", label: "200+" },
  { value: "start", label: "Ich starte gerade" },
] satisfies Array<ChoiceOption & { value: PartnerStudentCount }>;

const PARTNER_OFFERING_OPTIONS = [
  { value: "teaching", label: "Ich kann Unterricht für Quiz Arena Lernende geben" },
  { value: "ads", label: "Ich möchte Werbung / Integration platzieren" },
  { value: "content", label: "Ich habe Content (Video/Artikel/Materialien)" },
  { value: "product", label: "Ich möchte ein gemeinsames Produkt/Projekt" },
  { value: "other", label: "Etwas anderes" },
] satisfies Array<ChoiceOption & { value: PartnerOffering }>;

const PARTNER_TIMELINE_OPTIONS = [
  { value: "asap", label: "So schnell wie möglich" },
  { value: "month", label: "Innerhalb eines Monats" },
  { value: "explore", label: "Ich schaue mich erst um" },
] satisfies Array<ChoiceOption & { value: PartnerStartTimeline }>;

const INITIAL_PARTNER_STATE: PartnerFormState = {
  name: "",
  partnerType: "",
  country: "",
  studentCount: "",
  offerings: [],
  contact: "",
  website: "",
  idea: "",
  startTimeline: "",
  company: "",
};

export function PartnerWizard({ onClose }: WizardProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<PartnerFormState>(INITIAL_PARTNER_STATE);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorFieldId, setErrorFieldId] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const analytics = useContactAnalytics("partner");
  const submitting = useRef(false);

  useEffect(() => {
    if (!errorFieldId) return;
    const errorField = document.getElementById(errorFieldId);
    errorField?.focus();
  }, [errorFieldId]);

  function validateCurrentStep(currentStep: number): ValidationResult | null {
    if (currentStep === 1) {
      if (!form.name.trim()) {
        return { message: "Bitte gib deinen Namen oder den Organisationsnamen ein.", fieldId: PARTNER_NAME_FIELD_ID };
      }
      if (!form.partnerType) {
        return { message: "Bitte wähle aus, wer ihr seid.", fieldId: PARTNER_TYPE_FIELD_ID };
      }
      if (!form.country.trim()) {
        return { message: "Bitte gib Land/Stadt an.", fieldId: PARTNER_COUNTRY_FIELD_ID };
      }
      if (!form.studentCount) {
        return {
          message: "Bitte wähle die aktuelle Zahl eurer Lernenden.",
          fieldId: PARTNER_COUNT_FIELD_ID,
        };
      }
      if (!form.offerings.length) {
        return {
          message: "Bitte wähle mindestens ein Kooperationsangebot.",
          fieldId: PARTNER_OFFERINGS_FIELD_ID,
        };
      }
      return null;
    }

    if (!form.contact.trim()) {
      return { message: "Bitte gib Telegram oder Email an.", fieldId: PARTNER_CONTACT_FIELD_ID };
    }
    if (!form.idea.trim()) {
      return { message: "Bitte beschreibe eure Idee.", fieldId: "partner-idea" };
    }
    if (!form.startTimeline) {
      return { message: "Bitte gib an, wann ihr starten möchtet.", fieldId: "partner-start-timeline" };
    }

    return null;
  }

  function handleNext() {
    const validationError = validateCurrentStep(step);
    if (validationError) {
      analytics.validationError();
      setErrorMessage(validationError.message);
      setErrorFieldId(validationError.fieldId);
      return;
    }
    setErrorMessage(null);
    setErrorFieldId(null);
    setStep((current) => Math.min(current + 1, 2));
  }

  function handleBack() {
    setErrorMessage(null);
    setErrorFieldId(null);
    setStep((current) => Math.max(current - 1, 1));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const validationError = validateCurrentStep(2);
    if (validationError) {
      analytics.validationError();
      setErrorMessage(validationError.message);
      setErrorFieldId(validationError.fieldId);
      return;
    }

    submitting.current = true;
    setSubmitState("loading");
    setErrorMessage(null);
    setErrorFieldId(null);

    let context: ContactAnalyticsContext | undefined;
    try {
      const payload = partnerContactRequestSchema.parse({
        type: "partner",
        name: form.name.trim(),
        partnerType: form.partnerType,
        country: form.country.trim(),
        studentCount: form.studentCount,
        offerings: form.offerings,
        contact: form.contact.trim(),
        website: form.website.trim(),
        idea: form.idea.trim(),
        startTimeline: form.startTimeline,
        company: form.company,
      });
      context = await analytics.submit();
      await submitContactRequest(payload, context);
      setSubmitState("success");

    } catch (error) {
      analytics.submissionError(error, context);
      setSubmitState("error");
      setErrorMessage("Etwas ist schiefgelaufen. Bitte versuche es erneut.");
      setErrorFieldId(PARTNER_ERROR_ID);
    } finally {
      submitting.current = false;
    }
  }

  if (submitState === "success") {
    return (
      <div className="space-y-4 py-6 text-center">
        <p className="text-5xl">✅</p>
        <h4 className="break-words text-xl font-semibold text-slate-900 sm:text-2xl">
          Danke für euren Vorschlag!
        </h4>
        <p className="text-sm text-slate-600">
          Wir haben eure Kooperationsanfrage erhalten und melden uns mit den nächsten Schritten.
        </p>
        <button
          type="button"
          className="min-h-11 w-full rounded-full bg-slate-800 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 sm:w-auto"
          onClick={onClose}
        >
          Fenster schließen
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <HoneypotField
        fieldId="partner-company"
        value={form.company}
        onChange={(value) => setForm((prev) => ({ ...prev, company: value }))}
      />
      <StepIndicator current={step} total={2} />

      {step === 1 ? (
        <div className="space-y-4">
          <div>
            <label htmlFor={PARTNER_NAME_FIELD_ID} className="block text-sm font-medium text-slate-700">
              Name oder Organisation
            </label>
            <input
              id={PARTNER_NAME_FIELD_ID}
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className={`${INPUT_CLASS} mt-1`}
              placeholder="Name / Organisation"
              autoComplete="organization"
              required
              aria-required="true"
              aria-invalid={errorFieldId === PARTNER_NAME_FIELD_ID}
              aria-describedby={errorFieldId === PARTNER_NAME_FIELD_ID ? PARTNER_ERROR_ID : undefined}
            />
          </div>

          <fieldset
            id={PARTNER_TYPE_FIELD_ID}
            tabIndex={-1}
            className="space-y-1"
            aria-invalid={errorFieldId === PARTNER_TYPE_FIELD_ID}
            aria-describedby={errorFieldId === PARTNER_TYPE_FIELD_ID ? PARTNER_ERROR_ID : undefined}
          >
            <legend className="text-sm font-medium text-slate-700">Wer seid ihr?</legend>
            <div className="mt-2">
              <ChoiceCards
                options={PARTNER_TYPE_OPTIONS}
                value={form.partnerType}
                onChange={(value) => setForm((prev) => ({ ...prev, partnerType: value }))}
              />
            </div>
          </fieldset>

          <div>
            <label htmlFor={PARTNER_COUNTRY_FIELD_ID} className="mb-1 block text-sm font-medium text-slate-700">
              In welchem Land arbeitet ihr?
            </label>
            <input
              id={PARTNER_COUNTRY_FIELD_ID}
              value={form.country}
              onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
              className={`${INPUT_CLASS} mt-1`}
              placeholder="Land / Stadt"
              required
              aria-required="true"
              aria-invalid={errorFieldId === PARTNER_COUNTRY_FIELD_ID}
              aria-describedby={errorFieldId === PARTNER_COUNTRY_FIELD_ID ? PARTNER_ERROR_ID : undefined}
            />
          </div>

          <fieldset
            id={PARTNER_COUNT_FIELD_ID}
            tabIndex={-1}
            className="space-y-1"
            aria-invalid={errorFieldId === PARTNER_COUNT_FIELD_ID}
            aria-describedby={errorFieldId === PARTNER_COUNT_FIELD_ID ? PARTNER_ERROR_ID : undefined}
          >
            <legend className="text-sm font-medium text-slate-700">
              Wie viele Lernende habt ihr aktuell?
            </legend>
            <div className="mt-2">
              <ChoiceCards
                options={PARTNER_STUDENT_COUNT_OPTIONS}
                value={form.studentCount}
                onChange={(value) => setForm((prev) => ({ ...prev, studentCount: value }))}
              />
            </div>
          </fieldset>

          <fieldset
            id={PARTNER_OFFERINGS_FIELD_ID}
            tabIndex={-1}
            className="space-y-1"
            aria-invalid={errorFieldId === PARTNER_OFFERINGS_FIELD_ID}
            aria-describedby={errorFieldId === PARTNER_OFFERINGS_FIELD_ID ? PARTNER_ERROR_ID : undefined}
          >
            <legend className="text-sm font-medium text-slate-700">Was bietet ihr für eine Kooperation an?</legend>
            <div className="mt-2">
              <MultiChoiceCards
                options={PARTNER_OFFERING_OPTIONS}
                values={form.offerings}
                onToggle={(value) =>
                  setForm((prev) => ({ ...prev, offerings: toggleInList(prev.offerings, value) }))
                }
                columnsClass="grid-cols-1"
              />
            </div>
          </fieldset>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div>
            <label htmlFor={PARTNER_CONTACT_FIELD_ID} className="mb-1 block text-sm font-medium text-slate-700">
              Telegram oder Email
            </label>
            <input
              id={PARTNER_CONTACT_FIELD_ID}
              value={form.contact}
              onChange={(event) => setForm((prev) => ({ ...prev, contact: event.target.value }))}
              className={`${INPUT_CLASS} mt-1`}
              placeholder="@username oder email@beispiel.de"
              autoComplete="email"
              required
              aria-required="true"
              aria-invalid={errorFieldId === PARTNER_CONTACT_FIELD_ID}
              aria-describedby={errorFieldId === PARTNER_CONTACT_FIELD_ID ? PARTNER_ERROR_ID : undefined}
            />
          </div>

          <div>
            <label htmlFor="partner-website" className="mb-1 block text-sm font-medium text-slate-700">
              Website oder Social Media (optional)
            </label>
            <input
              id="partner-website"
              value={form.website}
              onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
              className={`${INPUT_CLASS} mt-1`}
              placeholder="Damit wir eure Arbeit kennenlernen"
            />
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Erzählt uns von eurer Idee
            <textarea
              id="partner-idea"
              value={form.idea}
              onChange={(event) => setForm((prev) => ({ ...prev, idea: event.target.value }))}
              className={`${INPUT_CLASS} mt-1`}
              rows={4}
              placeholder="Was bietet ihr an und was erwartet ihr von der Kooperation?"
              required
              aria-required="true"
              aria-invalid={errorFieldId === "partner-idea"}
              aria-describedby={errorFieldId === "partner-idea" ? PARTNER_ERROR_ID : undefined}
            />
          </label>

          <fieldset
            id="partner-start-timeline"
            tabIndex={-1}
            className="space-y-1"
            aria-invalid={errorFieldId === "partner-start-timeline"}
            aria-describedby={errorFieldId === "partner-start-timeline" ? PARTNER_ERROR_ID : undefined}
          >
            <legend className="text-sm font-medium text-slate-700">Wie schnell möchtet ihr starten?</legend>
            <div className="mt-2">
              <ChoiceCards
                options={PARTNER_TIMELINE_OPTIONS}
                value={form.startTimeline}
                onChange={(value) => setForm((prev) => ({ ...prev, startTimeline: value }))}
                columnsClass="grid-cols-1"
              />
            </div>
          </fieldset>
        </div>
      ) : null}

      {errorMessage ? (
        <p
          id={PARTNER_ERROR_ID}
          ref={errorRef}
          className="text-sm text-red-600"
          role="alert"
          aria-live="assertive"
          tabIndex={-1}
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-col-reverse items-stretch gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleBack}
          className={`min-h-11 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:w-auto ${step === 1 ? "hidden sm:invisible sm:inline-flex" : ""}`}
        >
          ← Zurück
        </button>

        {step < 2 ? (
          <button
            type="button"
            onClick={handleNext}
            className="min-h-11 w-full rounded-full bg-slate-800 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 sm:w-auto"
          >
            Weiter →
          </button>
        ) : (
          <button
            type="submit"
            disabled={submitState === "loading"}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-800 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
          >
            {submitState === "loading" ? (
              <>
                <Spinner /> Wird gesendet...
              </>
            ) : (
              "Vorschlag senden →"
            )}
          </button>
        )}
      </div>
    </form>
  );
}
