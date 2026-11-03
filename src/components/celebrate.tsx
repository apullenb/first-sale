"use client";

import { useLayoutEffect, useRef, useState } from "react";

const EVENT = "first-sale:done";

export interface Done {
  title: string;
  // Menu steps that just turned done, so their checks can draw in
  hrefs: string[];
}

// Stamps "Done" over the page; call it once a step is saved as done
export function celebrate(title: string, hrefs: string[] = []) {
  window.dispatchEvent(new CustomEvent<Done>(EVENT, { detail: { title, hrefs } }));
}

export function onCelebrate(listener: (done: Done) => void): () => void {
  const handle = (event: Event) => listener((event as CustomEvent<Done>).detail);
  window.addEventListener(EVENT, handle);
  return () => window.removeEventListener(EVENT, handle);
}

// One stamp at a time: a step, then the section it finished
export function Celebration() {
  const [shown, setShown] = useState<{ title: string; id: number } | null>(null);
  const queue = useRef<string[]>([]);
  const busy = useRef<string | null>(null);
  const ids = useRef(0);
  // A layout effect, so it's listening before the menu checks for newly done steps
  useLayoutEffect(
    () =>
      onCelebrate(({ title }) => {
        if (busy.current === title || queue.current.includes(title) || queue.current.length >= 2) return;
        if (busy.current !== null) {
          queue.current.push(title);
          return;
        }
        busy.current = title;
        setShown({ title, id: ++ids.current });
      }),
    [],
  );
  // Each stamp ends with its animation, so a hidden tab picks up where it left off
  const advance = () => {
    const next = queue.current.shift() ?? null;
    busy.current = next;
    setShown(next === null ? null : { title: next, id: ++ids.current });
  };

  return (
    <>
      <p role="status" className="sr-only">
        {shown ? `Done: ${shown.title}` : ""}
      </p>
      {shown ? (
        <div key={shown.id} aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-[24%] z-50 flex justify-center px-4 md:pl-[300px]">
          <div
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget) advance();
            }}
            className="flex max-w-[340px] animate-stamp flex-col items-center gap-0.5 rounded-xl border-[3px] border-done bg-surface/90 px-7 pb-3 pt-2 text-done shadow-lift ring-[1.5px] ring-done/50 ring-offset-[3px] ring-offset-surface/90"
          >
            <span className="text-[40px] font-extrabold uppercase leading-none tracking-[0.2em]">Done</span>
            <span className="text-center text-[14px] font-bold leading-snug">{shown.title}</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
