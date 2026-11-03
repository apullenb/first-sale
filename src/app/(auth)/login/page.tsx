import type { Metadata } from "next";
import { TryDemoLink } from "@/components/auth/try-demo-link";
import { LogInForm } from "@/components/auth/log-in-form";

export const metadata: Metadata = { title: "Log in" };

export default function LogInPage() {
  return (
    <>
      <LogInForm />
      <TryDemoLink />
    </>
  );
}
