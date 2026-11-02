import type { Metadata } from "next";
import Link from "next/link";
import { EYEBROW, PRIMARY_LINK, TEXT_LINK } from "@/components/styles";

export const metadata: Metadata = { title: "Demo not available" };

export default function DemoUnavailablePage() {
  return (
    <div className="my-auto flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <p className={EYEBROW}>Demo</p>
        <h1 className="font-display text-[30px] leading-[1.15] tracking-[-0.01em] sm:text-[34px]">The demo isn’t available</h1>
        <p className="text-muted">There’s no demo business to show right now. You can start your own instead.</p>
      </div>
      <Link href="/signup" className={`${PRIMARY_LINK} w-full`}>
        Create an account
      </Link>
      <p className="border-t border-line pt-4 text-[15px] text-muted">
        Already have one?{" "}
        <Link href="/login" className={`inline-flex min-h-11 items-center ${TEXT_LINK}`}>
          Log in
        </Link>
      </p>
    </div>
  );
}
