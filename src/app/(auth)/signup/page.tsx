import type { Metadata } from "next";
import { TryDemoLink } from "@/components/auth/try-demo-link";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <>
      <SignUpForm />
      <TryDemoLink />
    </>
  );
}
