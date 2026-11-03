"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { RequestImport } from "@/components/operations/inbox";
import { SECONDARY } from "@/components/styles";

// Other ways to add: an uploaded invoice, a pasted email, or the email demo
export function ImportPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" aria-expanded={open} className={SECONDARY} onClick={() => setOpen(!open)}>
        <Icon name="upload" size="sm" />
        Add from invoice or email
      </button>
      {open ? (
        <section
          aria-label="Add from invoice or email"
          className="absolute right-0 z-30 mt-2 flex w-[min(30rem,calc(100vw-2rem))] flex-col gap-3 rounded-[14px] border border-line bg-surface p-4 shadow-lift"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Add from invoice or email</h2>
            <button type="button" className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-wash" onClick={() => setOpen(false)}>
              <Icon name="close" size="sm" />
              <span className="sr-only">Close</span>
            </button>
          </div>
          <RequestImport quiet />
          <Link href="/email/demo" className="text-sm font-semibold text-accent">
            Or try the customer email demo
          </Link>
        </section>
      ) : null}
    </div>
  );
}
