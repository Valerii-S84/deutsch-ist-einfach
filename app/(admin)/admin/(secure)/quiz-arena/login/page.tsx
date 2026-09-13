"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api, classifyApiError } from "@/lib/quiz-arena-api";
import { apiRoutes } from "@/lib/quiz-arena-routes";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type LoginForm = z.infer<typeof loginSchema>;
type LoginResponse = {
  requires_2fa: boolean;
};

export default function AdminLoginPage() {
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [is2FALoading, setIs2FALoading] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginForm) {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const response = await api.post<LoginResponse>(apiRoutes.admin.auth.login, values);
      if (response.data.requires_2fa) {
        setRequires2FA(true);
        return;
      }
      window.location.href = "/admin/quiz-arena/dashboard";
    } catch (error) {
      const errorCode = classifyApiError(error);
      if (errorCode === "TOO_MANY_REQUESTS") {
        setErrorMessage("Занадто багато спроб входу. Спробуйте пізніше.");
      } else if (errorCode === "CSRF_VALIDATION_FAILED" || errorCode === "AUTH_FORBIDDEN") {
        setErrorMessage("Спроба входу блокована захистом безпеки. Оновіть сторінку та спробуйте знову.");
      } else if (errorCode === "NETWORK_ERROR") {
        setErrorMessage("Мережеві проблеми. Перевірте з'єднання.");
      } else {
        setErrorMessage("Не вдалося увійти. Перевір email/password.");
      }
      setRequires2FA(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verify2FA() {
    setErrorMessage(null);
    setIs2FALoading(true);
    try {
      await api.post(apiRoutes.admin.auth.verify2FA, { code: totpCode });
      window.location.href = "/admin/quiz-arena/dashboard";
    } catch (error) {
      const errorCode = classifyApiError(error);
      if (errorCode === "TOO_MANY_REQUESTS") {
        setErrorMessage("Занадто багато невдалих спроб 2FA. Зачекайте й спробуйте знову.");
      } else {
        setErrorMessage("Невірний 2FA код.");
      }
    } finally {
      setIs2FALoading(false);
    }
  }

  function handleVerifySubmit(event: FormEvent) {
    event.preventDefault();
    void verify2FA();
  }

  useEffect(() => {
    if (errorMessage) {
      errorRef.current?.focus();
    }
  }, [errorMessage]);

  useEffect(() => {
    if (!form.formState.isSubmitted) {
      return;
    }
    if (form.formState.errors.email) {
      document.getElementById("admin-email")?.focus();
      return;
    }
    if (form.formState.errors.password) {
      document.getElementById("admin-password")?.focus();
    }
  }, [form.formState.errors.email, form.formState.errors.password, form.formState.isSubmitted]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="surface rounded-2xl p-6">
        <h1 className="text-3xl">Quiz Arena Bot Login</h1>
        {!requires2FA ? (
          <form
            className="mt-5 space-y-4"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            aria-live="polite"
          >
            <div>
              <label htmlFor="admin-email" className="mb-1 block text-sm font-medium text-white">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                className="w-full rounded-xl border border-ember/20 bg-white px-3 py-2"
                placeholder="Email"
                aria-invalid={form.formState.errors.email ? "true" : "false"}
                aria-describedby={form.formState.errors.email ? "admin-email-error" : undefined}
                {...form.register("email")}
              />
            </div>
            {form.formState.errors.email ? (
              <p id="admin-email-error" className="text-sm text-red-600">
                {form.formState.errors.email.message}
              </p>
            ) : null}

            <div>
              <label
                htmlFor="admin-password"
                className="mb-1 block text-sm font-medium text-white"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                className="w-full rounded-xl border border-ember/20 bg-white px-3 py-2"
                placeholder="Password"
                aria-invalid={form.formState.errors.password ? "true" : "false"}
                aria-describedby={form.formState.errors.password ? "admin-password-error" : undefined}
                {...form.register("password")}
              />
            </div>
            {form.formState.errors.password ? (
              <p id="admin-password-error" className="text-sm text-red-600">
                {form.formState.errors.password.message}
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-xl bg-ember px-3 py-2 text-sand disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || form.formState.isSubmitting}
            >
              {isSubmitting || form.formState.isSubmitting ? "Signin..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form className="mt-5 space-y-3" onSubmit={handleVerifySubmit} noValidate>
            <div>
              <label
                htmlFor="admin-2fa-code"
                className="mb-1 block text-sm font-medium text-white"
              >
                2FA Code
              </label>
              <input
                id="admin-2fa-code"
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value)}
                className="w-full rounded-xl border border-ember/20 bg-white px-3 py-2"
                placeholder="2FA Code"
              />
            </div>
            <button
              className="w-full rounded-xl bg-coral px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={is2FALoading}
            >
              {is2FALoading ? "Verifying..." : "Verify 2FA"}
            </button>
          </form>
        )}
        {errorMessage ? (
          <p
            ref={errorRef}
            id="admin-login-error"
            className="mt-4 text-sm text-red-700"
            role="alert"
            aria-live="polite"
            tabIndex={-1}
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    </main>
  );
}
