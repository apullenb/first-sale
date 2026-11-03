"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { ALERT, EYEBROW, PRIMARY, SECONDARY, TEXT_LINK } from "@/components/styles";
import { authClient } from "@/lib/auth/client";
import {
  authErrorMessage,
  isValidEmail,
  NAME_MAX_LENGTH,
  NETWORK_ERROR_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/rules";
import { TextField } from "./text-field";

const EMPTY = { name: "", email: "", password: "" };

export function SignUpForm() {
  const [values, setValues] = useState(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  const [tried, setTried] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const name = values.name.trim();
  const problems = {
    name: !name ? "Enter your name." : name.length > NAME_MAX_LENGTH ? `Use ${NAME_MAX_LENGTH} characters or fewer.` : null,
    email: isValidEmail(values.email) ? null : "Enter an email like name@example.com.",
    password:
      values.password.length < PASSWORD_MIN_LENGTH
        ? `Use at least ${PASSWORD_MIN_LENGTH} characters.`
        : values.password.length > PASSWORD_MAX_LENGTH
          ? `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`
          : null,
  };
  const set = (field: keyof typeof EMPTY) => (value: string) => setValues((v) => ({ ...v, [field]: value }));

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
    const firstProblem = (["name", "email", "password"] as const).find((field) => problems[field]);
    if (firstProblem) {
      document.getElementById(`signup-${firstProblem}`)?.focus();
      return;
    }

    setPending(true);
    try {
      const { error } = await authClient.signUp.email({ name, email: values.email.trim(), password: values.password });
      if (error) {
        showFormError(authErrorMessage(error));
        return;
      }
    } catch {
      showFormError(NETWORK_ERROR_MESSAGE);
      return;
    }
    // Full page load so no kept screen holds this form's state; replace keeps it out of Back
    setValues(EMPTY);
    window.location.replace("/business/new");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="my-auto flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <p className={EYEBROW}>Get started</p>
        <h1 className="font-display text-[30px] leading-[1.15] tracking-[-0.01em] sm:text-[34px]">Create your account</h1>
        <p className="text-muted">Then answer a few quick questions about your business.</p>
      </div>
      <TextField
        id="signup-name"
        label="Your name"
        autoComplete="name"
        value={values.name}
        onChange={(e) => set("name")(e.target.value)}
        error={tried ? problems.name : null}
      />
      <TextField
        id="signup-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={values.email}
        onChange={(e) => set("email")(e.target.value)}
        error={tried ? problems.email : null}
      />
      <TextField
        id="signup-password"
        label="Password"
        type={showPassword ? "text" : "password"}
        autoComplete="new-password"
        value={values.password}
        onChange={(e) => set("password")(e.target.value)}
        error={tried ? problems.password : null}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        addon={
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-controls="signup-password"
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
        {pending ? "Creating your account…" : "Create account"}
      </button>
      <p className="border-t border-line pt-4 text-[15px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className={`inline-flex min-h-11 items-center ${TEXT_LINK}`}>
          Log in
        </Link>
      </p>
    </form>
  );
}
