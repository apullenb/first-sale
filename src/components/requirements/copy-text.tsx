"use client";

import { useState } from "react";
import { SECONDARY } from "@/components/styles";

// Copies prepared text, such as a written question to an office; the text stays visible for copying by hand
export function CopyText({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("yes");
    } catch {
      setCopied("no");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button type="button" onClick={copy} className={SECONDARY}>
        {label}
      </button>
      <p role="status" className={copied ? "text-sm text-muted" : "sr-only"}>
        {copied === "yes" ? "Copied. Paste it into the office’s contact form or an email." : copied === "no" ? "Couldn’t copy. Select the text above and copy it yourself." : ""}
      </p>
    </div>
  );
}
