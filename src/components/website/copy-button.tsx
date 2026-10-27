"use client";

import { useState } from "react";
import { SECONDARY } from "@/components/styles";

// Copies one piece of the site's words, for pasting into the website builder
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2500);
  }

  return (
    <span className="flex items-center gap-2">
      <button type="button" onClick={copy} className={SECONDARY} aria-label={`Copy ${label}`}>
        Copy
      </button>
      <span role="status" className="text-sm text-muted">
        {state === "copied" ? "Copied" : state === "failed" ? "Couldn’t copy. Select the text and copy it instead." : ""}
      </span>
    </span>
  );
}
