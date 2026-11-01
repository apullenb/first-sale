import Link from "next/link";
import { Logo } from "@/components/logo";
import { PRIMARY_LINK } from "@/components/styles";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-10">
      <Logo className="w-40" />
      <h1 className="font-display text-[32px] leading-[1.15]">Page not found</h1>
      <p className="text-lg text-muted">This page doesn’t exist, or the link has changed.</p>
      <Link href="/" className={PRIMARY_LINK}>
        Go to Today
      </Link>
    </main>
  );
}
