"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { SECONDARY } from "@/components/styles";

const FOCUSABLE = "input:not([type=hidden]):not([disabled]), button:not([disabled]), textarea, select, a[href]";

// A button that opens a panel in its place, such as an upload form, with a way to close it. Focus moves with it.
export function Reveal({ label, icon, children }: { label: string; icon: IconName; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    if (open) panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    else button.current?.focus();
  }, [open]);
  const toggle = (next: boolean) => {
    moved.current = true;
    setOpen(next);
  };

  if (!open) {
    return (
      <button ref={button} type="button" onClick={() => toggle(true)} className={`${SECONDARY} w-fit`}>
        <Icon name={icon} size="sm" />
        {label}
      </button>
    );
  }
  return (
    <div ref={panel} role="group" aria-label={label} className="flex w-full flex-col gap-2">
      {children}
      <button type="button" onClick={() => toggle(false)} className={`${SECONDARY} w-fit`}>
        <Icon name="close" size="sm" />
        Close
      </button>
    </div>
  );
}
