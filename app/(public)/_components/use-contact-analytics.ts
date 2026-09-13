"use client";

import { useEffect, useRef } from "react";
import { usePublicAnalytics } from "@/app/analytics-provider";
import type { AnalyticsFormId, ContactAnalyticsContext } from "@/lib/analytics/contract";
import { ContactRequestError } from "@/lib/contact/contact-client";

export function useContactAnalytics(form: AnalyticsFormId) {
  const { trackEvent, prepareFormSubmission } = usePublicAnalytics();
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    trackEvent("wizard_open", { wizard_type: form });
  }, [form, trackEvent]);
  return {
    validationError: () => trackEvent("form_error", { form_id: form, error_code: "validation_error" }),
    submit: () => prepareFormSubmission?.(form),
    submissionError: (error: unknown, context?: ContactAnalyticsContext) => {
      if (!context) return;
      trackEvent("form_error", {
        form_id: form, form_instance_id: context.form_instance_id, submission_attempt_id: context.submission_attempt_id,
        error_code: error instanceof ContactRequestError ? error.code : "unknown_error",
      });
    },
  };
}
