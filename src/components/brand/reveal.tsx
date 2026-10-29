"use client";

import { type ReactNode, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { SECONDARY } from "@/components/styles";

// A button that opens a panel in its place, such as an upload form, with a way to close it
export function Reveal({ label, icon, children }: { label: string; icon: IconName; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${SECONDARY} w-fit`}>
        <Icon name={icon} size="sm" />
        {label}
      </button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2">
      {children}
      <button type="button" onClick={() => setOpen(false)} className={`${SECONDARY} w-fit`}>
        <Icon name="close" size="sm" />
        Close
      </button>
    </div>
  );
}
