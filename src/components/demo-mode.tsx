"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DEMO_BUTTON } from "@/lib/demo";

// Read-only demo in the browser: buttons that save are disabled and say so. The server refuses demo writes either way.

let demo = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setDemo(value: boolean) {
  demo = value;
  listeners.forEach((listener) => listener());
}

// True in a demo session, for components that disable their own buttons
export function useDemo(): boolean {
  return useSyncExternalStore(subscribe, () => demo, () => false);
}

// Form submit buttons and anything marked data-writes, inside the page; forms marked data-demo-ok only read
const SAVES = "form:not([data-demo-ok]) button:not([type=button]):not([type=reset]), [data-writes]";

function turnOff(element: HTMLElement) {
  if (element.hasAttribute("data-demo-off")) {
    if (!(element as HTMLButtonElement).disabled) (element as HTMLButtonElement).disabled = true;
    return;
  }
  element.setAttribute("data-demo-off", "");
  element.setAttribute("aria-disabled", "true");
  element.setAttribute("title", DEMO_BUTTON);
  if (element instanceof HTMLButtonElement) element.setAttribute("aria-label", DEMO_BUTTON);
  (element as HTMLButtonElement).disabled = true;
}

// Mounted only for demo sessions
export function DemoGuard() {
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    setDemo(true);
    const sweep = () => main.querySelectorAll<HTMLElement>(SAVES).forEach(turnOff);
    // Pages render and re-render after this, and may turn a button back on
    const observer = new MutationObserver(sweep);
    observer.observe(main, { subtree: true, childList: true, attributes: true, attributeFilter: ["disabled"] });
    sweep();
    const block = (event: Event) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (form?.hasAttribute("data-demo-ok")) return;
      event.preventDefault();
      event.stopPropagation();
    };
    main.addEventListener("submit", block, true);
    return () => {
      observer.disconnect();
      main.removeEventListener("submit", block, true);
      setDemo(false);
    };
  }, []);
  return null;
}
