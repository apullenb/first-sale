"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { ALERT, EYEBROW, PRIMARY, SECONDARY, TEXT_LINK } from "@/components/styles";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage, isValidEmail, NETWORK_ERROR_MESSAGE } from "@/lib/auth/rules";
import { TextField } from "./text-field";

export function LogInForm() {
  const [values, setValues] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
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
    <form onSubmit={onSubmit} noValidate className="my-auto flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <p className={EYEBROW}>Log in</p>
        <h1 className="font-display text-[30px] leading-[1.15] tracking-[-0.01em] sm:text-[34px]">Welcome back</h1>
        <p className="text-muted">Pick up where you left off.</p>
      </div>
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
        type={showPassword ? "text" : "password"}
        autoComplete="current-password"
        value={values.password}
        onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
        error={tried ? problems.password : null}
        addon={
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-controls="login-password"
            className={`${SECONDARY} min-w-18`}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        }
      />
      {formError ? (
        <p ref={errorRef} role="alert" tabIndex={-1} className={ALERT}>
          {formError}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={`${PRIMARY} w-full`}
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="border-t border-line pt-4 text-[15px] text-muted">
        New here?{" "}
        <Link href="/signup" className={`inline-flex min-h-11 items-center ${TEXT_LINK}`}>
          Create an account
        </Link>
      </p>
    </form>
  );
}
