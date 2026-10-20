"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/umami";
import { ContactRequestError } from "@/lib/contact/contact-client";

type ContactForm = "student" | "partner";

export function useContactAnalytics(form: ContactForm) {
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    track("form-open", { form });
  }, [form]);
  return {
    validationError: () => track("form-error", { form, code: "validation_error" }),
    submissionError: (error: unknown) => {
      track("form-error", {
        form, code: error instanceof ContactRequestError ? error.code : "unknown_error",
      });
    },
    success: () => track("form-success", { form }),
  };
}
