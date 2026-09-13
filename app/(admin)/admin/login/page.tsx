"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginForm) {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (response.ok) {
        window.location.href = "/admin/products";
      } else if (response.status === 429) {
        setErrorMessage("Занадто багато спроб входу. Спробуйте пізніше.");
      } else if (response.status === 403) {
        setErrorMessage("Спроба входу блокована захистом безпеки. Оновіть сторінку та спробуйте знову.");
      } else if (response.status === 503) {
        setErrorMessage("Вхід адміністратора тимчасово недоступний.");
      } else {
        setErrorMessage("Не вдалося увійти. Перевір email/password.");
      }
    } catch {
      setErrorMessage("Мережеві проблеми. Перевірте з'єднання.");
    } finally {
      setIsSubmitting(false);
    }
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
        <h1 className="text-3xl">Admin Login</h1>
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
              autoComplete="username"
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
              autoComplete="current-password"
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
