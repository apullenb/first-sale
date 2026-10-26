"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage, isValidEmail, NETWORK_ERROR_MESSAGE } from "@/lib/auth/rules";
import { TextField } from "./text-field";

export function LogInForm() {
  const [values, setValues] = useState({ email: "", password: "" });
  const [tried, setTried] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const problems = {
    email: isValidEmail(values.email) ? null : "Enter the email you signed up with.",
    password: values.password ? null : "Enter your password.",
  };

  function showFormError(message: string) {
    flushSync(() => {
      setFormError(message);
      setPending(false);
    });
    errorRef.current?.focus();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Render the errors first so the focused field already announces its message
    flushSync(() => {
      setTried(true);
      setFormError(null);
    });
    const firstProblem = (["email", "password"] as const).find((field) => problems[field]);
    if (firstProblem) {
      document.getElementById(`login-${firstProblem}`)?.focus();
      return;
    }

    setPending(true);
    try {
      const { error } = await authClient.signIn.email({ email: values.email.trim(), password: values.password });
      if (error) {
        showFormError(authErrorMessage(error));
        return;
      }
    } catch {
      showFormError(NETWORK_ERROR_MESSAGE);
      return;
    }
    // Full page load so no kept screen holds this form's state; replace keeps it out of Back
    setValues({ email: "", password: "" });
    window.location.replace("/");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back</h1>
      <TextField
        id="login-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={values.email}
        onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
        error={tried ? problems.email : null}
      />
      <TextField
        id="login-password"
        label="Password"
        type="password"
        autoComplete="current-password"
        value={values.password}
        onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
        error={tried ? problems.password : null}
      />
      {formError ? (
        <p ref={errorRef} role="alert" tabIndex={-1} className="rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">
          {formError}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-lg bg-accent px-5 font-bold text-white hover:bg-accent-ink disabled:opacity-60"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="text-[15px]">
        New here?{" "}
        <Link href="/signup" className="inline-flex min-h-11 items-center font-bold text-accent-ink underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}
