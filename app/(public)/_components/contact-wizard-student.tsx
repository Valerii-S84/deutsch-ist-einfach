"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import type { ContactAnalyticsContext } from "@/lib/analytics/contract";
import { useContactAnalytics } from "./use-contact-analytics";
import { submitContactRequest } from "@/lib/contact/contact-client";
import {
  studentContactRequestSchema,
  type StudentAgeGroup,
  type StudentBudget,
  type StudentFormat,
  type StudentFrequency,
  type StudentGoal,
  type StudentLevel,
  type StudentTimeSlot,
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

type StudentFormState = {
  name: string;
  ageGroup: string;
  level: string;
  goals: string[];
  format: string;
  timeSlots: string[];
  frequency: string;
  budget: string;
  contact: string;
  message: string;
  company: string;
};

type ValidationResult = {
  message: string;
  fieldId: string | null;
};

const STUDENT_ERROR_ID = "student-form-error";
const STUDENT_NAME_FIELD_ID = "student-name";
const STUDENT_AGE_GROUP_FIELD_ID = "student-age-group";
const STUDENT_LEVEL_FIELD_ID = "student-level";
const STUDENT_GOALS_FIELD_ID = "student-goals";
const STUDENT_FORMAT_FIELD_ID = "student-format";
const STUDENT_TIME_FIELD_ID = "student-time";
const STUDENT_FREQUENCY_FIELD_ID = "student-frequency";
const STUDENT_CONTACT_FIELD_ID = "student-contact";

const STUDENT_AGE_OPTIONS = [
  { value: "unter_16", label: "Unter 16" },
  { value: "16_25", label: "16-25" },
  { value: "26_35", label: "26-35" },
  { value: "36_50", label: "36-50" },
  { value: "50_plus", label: "50+" },
] satisfies Array<ChoiceOption & { value: StudentAgeGroup }>;

const STUDENT_LEVEL_OPTIONS = [
  { value: "A1", label: "A1", description: "Nullniveau" },
  { value: "A2", label: "A2", description: "Anfänger" },
  { value: "B1", label: "B1", description: "Mittelstufe" },
  { value: "B2", label: "B2", description: "Gute Mittelstufe" },
  { value: "C1_C2", label: "C1/C2", description: "Fortgeschritten" },
  {
    value: "UNSICHER",
    label: "Ich weiß es nicht",
    description: "Bitte helft mir beim Einstufen",
  },
] satisfies Array<ChoiceOption & { value: StudentLevel }>;

const STUDENT_GOAL_OPTIONS = [
  { value: "alltag", label: "Im Alltag sprechen" },
  { value: "pruefung", label: "Prüfung bestehen (Goethe/telc/TestDaF)" },
  { value: "karriere", label: "Arbeit / Karriere in Deutschland" },
  { value: "umzug", label: "Umzug / Auswanderung" },
  { value: "universitaet", label: "Studium an der Universität" },
  { value: "reisen", label: "Reisen" },
  { value: "hobby", label: "Interesse / Hobby" },
] satisfies Array<ChoiceOption & { value: StudentGoal }>;

const STUDENT_FORMAT_OPTIONS = [
  { value: "individual", label: "Individuell mit Lehrkraft", icon: "👤" },
  { value: "group", label: "Mini-Gruppe (2-5 Personen)", icon: "👥" },
  { value: "self", label: "Selbstständig mit Bot/Material", icon: "📱" },
  { value: "undecided", label: "Noch nicht entschieden", icon: "🤷" },
] satisfies Array<ChoiceOption & { value: StudentFormat }>;

const STUDENT_TIME_OPTIONS = [
  { value: "morning", label: "Morgen (bis 12:00)" },
  { value: "day", label: "Tag (12:00-17:00)" },
  { value: "evening", label: "Abend (nach 17:00)" },
  { value: "weekend", label: "Wochenende" },
] satisfies Array<ChoiceOption & { value: StudentTimeSlot }>;

const STUDENT_FREQUENCY_OPTIONS = [
  { value: "once", label: "1x pro Woche" },
  { value: "twice", label: "2x pro Woche" },
  { value: "three_plus", label: "3+ pro Woche" },
  { value: "daily", label: "Täglich" },
] satisfies Array<ChoiceOption & { value: StudentFrequency }>;

const STUDENT_BUDGET_OPTIONS = [
  { value: "bis_50", label: "Bis 50 EUR" },
  { value: "50_100", label: "50-100 EUR" },
  { value: "100_200", label: "100-200 EUR" },
  { value: "200_plus", label: "200+ EUR" },
  { value: "offen", label: "Noch unklar" },
] satisfies Array<ChoiceOption & { value: StudentBudget }>;

const INITIAL_STUDENT_STATE: StudentFormState = {
  name: "",
  ageGroup: "",
  level: "",
  goals: [],
  format: "",
  timeSlots: [],
  frequency: "",
  budget: "",
  contact: "",
  message: "",
  company: "",
};

export function StudentWizard({ onClose }: WizardProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<StudentFormState>(INITIAL_STUDENT_STATE);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorFieldId, setErrorFieldId] = useState<string | null>(null);
  const [submittedName, setSubmittedName] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const analytics = useContactAnalytics("student");
  const submitting = useRef(false);

  useEffect(() => {
    if (!errorFieldId) return;
    const errorField = document.getElementById(errorFieldId);
    errorField?.focus();
  }, [errorFieldId]);

  function validateCurrentStep(currentStep: number): ValidationResult | null {
    if (currentStep === 1) {
      if (!form.name.trim()) {
        return { message: "Bitte gib deinen Namen ein.", fieldId: STUDENT_NAME_FIELD_ID };
      }
      if (!form.ageGroup) {
        return { message: "Bitte wähle eine Altersgruppe.", fieldId: STUDENT_AGE_GROUP_FIELD_ID };
      }
      if (!form.level) {
        return { message: "Bitte wähle dein aktuelles Deutschniveau.", fieldId: STUDENT_LEVEL_FIELD_ID };
      }
      if (!form.goals.length) {
        return { message: "Bitte wähle mindestens ein Lernziel.", fieldId: STUDENT_GOALS_FIELD_ID };
      }
      return null;
    }

    if (currentStep === 2) {
      if (!form.format) {
        return { message: "Bitte wähle einen Lernformat-Wunsch.", fieldId: STUDENT_FORMAT_FIELD_ID };
      }
      if (!form.timeSlots.length) {
        return { message: "Bitte wähle mindestens ein Zeitfenster.", fieldId: STUDENT_TIME_FIELD_ID };
      }
      if (!form.frequency) {
        return { message: "Bitte wähle, wie oft du lernen möchtest.", fieldId: STUDENT_FREQUENCY_FIELD_ID };
      }
      return null;
    }

    if (!form.contact.trim()) {
      return { message: "Bitte gib Telegram oder Email an.", fieldId: STUDENT_CONTACT_FIELD_ID };
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
    setStep((current) => Math.min(current + 1, 3));
  }

  function handleBack() {
    setErrorMessage(null);
    setErrorFieldId(null);
    setStep((current) => Math.max(current - 1, 1));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const validationError = validateCurrentStep(3);
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
      const payload = studentContactRequestSchema.parse({
        type: "student",
        name: form.name.trim(),
        ageGroup: form.ageGroup,
        level: form.level,
        goals: form.goals,
        format: form.format,
        timeSlots: form.timeSlots,
        frequency: form.frequency,
        budget: form.budget,
        contact: form.contact.trim(),
        message: form.message.trim(),
        company: form.company,
      });
      context = await analytics.submit();
      await submitContactRequest(payload, context);
      setSubmittedName(form.name.trim());
      setSubmitState("success");

    } catch (error) {
      analytics.submissionError(error, context);
      setSubmitState("error");
      setErrorMessage("Etwas ist schiefgelaufen. Bitte versuche es erneut.");
      setErrorFieldId(STUDENT_ERROR_ID);
    } finally {
      submitting.current = false;
    }
  }

  if (submitState === "success") {
    return (
      <div className="space-y-4 py-6 text-center">
        <p className="text-5xl">✅</p>
        <h4 className="break-words text-xl font-semibold text-slate-900 sm:text-2xl">
          Danke, {submittedName}!
        </h4>
        <p className="text-sm text-slate-600">
          Wir haben deine Anfrage erhalten und prüfen die nächsten sinnvollen Schritte. Wir melden
          uns möglichst zeitnah.
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
        fieldId="student-company"
        value={form.company}
        onChange={(value) => setForm((prev) => ({ ...prev, company: value }))}
      />
      <StepIndicator current={step} total={3} />

      {step === 1 ? (
        <div className="space-y-4">
          <div>
            <label htmlFor={STUDENT_NAME_FIELD_ID} className="mb-1 block text-sm font-medium text-slate-700">
              Wie heißt du?
            </label>
            <input
              id={STUDENT_NAME_FIELD_ID}
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className={`${INPUT_CLASS} mt-1`}
              placeholder="Dein Name"
              autoComplete="name"
              required
              aria-required="true"
              aria-invalid={errorFieldId === STUDENT_NAME_FIELD_ID}
              aria-describedby={errorFieldId === STUDENT_NAME_FIELD_ID ? STUDENT_ERROR_ID : undefined}
            />
          </div>

          <fieldset
            id={STUDENT_AGE_GROUP_FIELD_ID}
            tabIndex={-1}
            className="space-y-1"
            aria-invalid={errorFieldId === STUDENT_AGE_GROUP_FIELD_ID}
            aria-describedby={
              errorFieldId === STUDENT_AGE_GROUP_FIELD_ID ? STUDENT_ERROR_ID : undefined
            }
          >
            <legend className="text-sm font-medium text-slate-700">Wie alt bist du?</legend>
            <div className="mt-2">
              <ChoiceCards
                options={STUDENT_AGE_OPTIONS}
                value={form.ageGroup}
                onChange={(value) => setForm((prev) => ({ ...prev, ageGroup: value }))}
              />
            </div>
          </fieldset>

          <fieldset
            id={STUDENT_LEVEL_FIELD_ID}
            tabIndex={-1}
            className="space-y-1"
            aria-invalid={errorFieldId === STUDENT_LEVEL_FIELD_ID}
            aria-describedby={errorFieldId === STUDENT_LEVEL_FIELD_ID ? STUDENT_ERROR_ID : undefined}
          >
            <legend className="text-sm font-medium text-slate-700">
              Wie ist dein aktuelles Deutschniveau?
            </legend>
            <div className="mt-2">
              <ChoiceCards
                options={STUDENT_LEVEL_OPTIONS}
                value={form.level}
                onChange={(value) => setForm((prev) => ({ ...prev, level: value }))}
                columnsClass="grid-cols-1"
              />
            </div>
          </fieldset>

          <fieldset
            id={STUDENT_GOALS_FIELD_ID}
            tabIndex={-1}
            className="space-y-1"
            aria-invalid={errorFieldId === STUDENT_GOALS_FIELD_ID}
            aria-describedby={errorFieldId === STUDENT_GOALS_FIELD_ID ? STUDENT_ERROR_ID : undefined}
          >
            <legend className="text-sm font-medium text-slate-700">Was ist dein Hauptziel?</legend>
            <div className="mt-2">
              <MultiChoiceCards
                options={STUDENT_GOAL_OPTIONS}
                values={form.goals}
                onToggle={(value) =>
                  setForm((prev) => ({ ...prev, goals: toggleInList(prev.goals, value) }))
                }
                columnsClass="grid-cols-1"
              />
            </div>
          </fieldset>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <fieldset
            id={STUDENT_FORMAT_FIELD_ID}
            tabIndex={-1}
            className="space-y-1"
            aria-invalid={errorFieldId === STUDENT_FORMAT_FIELD_ID}
            aria-describedby={errorFieldId === STUDENT_FORMAT_FIELD_ID ? STUDENT_ERROR_ID : undefined}
          >
            <legend className="text-sm font-medium text-slate-700">Wie möchtest du lernen?</legend>
            <div className="mt-2">
              <ChoiceCards
                options={STUDENT_FORMAT_OPTIONS}
                value={form.format}
                onChange={(value) => setForm((prev) => ({ ...prev, format: value }))}
              />
            </div>
          </fieldset>

          <fieldset
            id={STUDENT_TIME_FIELD_ID}
            tabIndex={-1}
            className="space-y-1"
            aria-invalid={errorFieldId === STUDENT_TIME_FIELD_ID}
            aria-describedby={errorFieldId === STUDENT_TIME_FIELD_ID ? STUDENT_ERROR_ID : undefined}
          >
            <legend className="text-sm font-medium text-slate-700">Wann passt es dir?</legend>
            <div className="mt-2">
              <MultiChoiceCards
                options={STUDENT_TIME_OPTIONS}
                values={form.timeSlots}
                onToggle={(value) =>
                  setForm((prev) => ({ ...prev, timeSlots: toggleInList(prev.timeSlots, value) }))
                }
              />
            </div>
          </fieldset>

          <fieldset
            id={STUDENT_FREQUENCY_FIELD_ID}
            tabIndex={-1}
            className="space-y-1"
            aria-invalid={errorFieldId === STUDENT_FREQUENCY_FIELD_ID}
            aria-describedby={
              errorFieldId === STUDENT_FREQUENCY_FIELD_ID ? STUDENT_ERROR_ID : undefined
            }
          >
            <legend className="text-sm font-medium text-slate-700">Wie oft pro Woche?</legend>
            <div className="mt-2">
              <ChoiceCards
                options={STUDENT_FREQUENCY_OPTIONS}
                value={form.frequency}
                onChange={(value) => setForm((prev) => ({ ...prev, frequency: value }))}
              />
            </div>
          </fieldset>

          <div>
            <p className="text-sm font-medium text-slate-700">
              Budgetrahmen pro Monat (optional, nur zur Orientierung)
            </p>
            <div className="mt-2">
              <ChoiceCards
                options={STUDENT_BUDGET_OPTIONS}
                value={form.budget}
                onChange={(value) => setForm((prev) => ({ ...prev, budget: value }))}
              />
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <div>
            <label htmlFor={STUDENT_CONTACT_FIELD_ID} className="mb-1 block text-sm font-medium text-slate-700">
              Telegram oder Email
            </label>
            <input
              id={STUDENT_CONTACT_FIELD_ID}
              value={form.contact}
              onChange={(event) => setForm((prev) => ({ ...prev, contact: event.target.value }))}
              className={`${INPUT_CLASS} mt-1`}
              placeholder="@username oder email@beispiel.de"
              autoComplete="email"
              required
              aria-required="true"
              aria-invalid={errorFieldId === STUDENT_CONTACT_FIELD_ID}
              aria-describedby={errorFieldId === STUDENT_CONTACT_FIELD_ID ? STUDENT_ERROR_ID : undefined}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Wir nutzen diese Angabe nur, um auf deine Anfrage antworten zu können.
            </span>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Möchtest du etwas ergänzen? (optional)
            <textarea
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              className={`${INPUT_CLASS} mt-1`}
              rows={3}
              placeholder="Zum Beispiel: Ich habe schon gelernt, suche eine bestimmte Lehrkraft oder brauche Prüfungsvorbereitung."
            />
          </label>
        </div>
      ) : null}

      {errorMessage ? (
        <p
          id={STUDENT_ERROR_ID}
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

        {step < 3 ? (
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
              "Anfrage senden →"
            )}
          </button>
        )}
      </div>
    </form>
  );
}
