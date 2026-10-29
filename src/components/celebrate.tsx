"use client";

import { useEffect, useState } from "react";

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
  useEffect(() => {
    const queue: string[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let id = 0;
    const next = () => {
      const title = queue.shift();
      if (title === undefined) {
        timer = undefined;
        setShown(null);
        return;
      }
      setShown({ title, id: ++id });
      timer = setTimeout(next, 2300);
    };
    const stop = onCelebrate(({ title }) => {
      if (queue.includes(title) || queue.length >= 2) return;
      queue.push(title);
      if (!timer) next();
    });
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <p role="status" className="sr-only">
        {shown ? `Done: ${shown.title}` : ""}
      </p>
      {shown ? (
        <div key={shown.id} aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-[24%] z-50 flex justify-center px-4 md:pl-[300px]">
          <div className="flex max-w-[340px] animate-stamp flex-col items-center gap-0.5 rounded-xl border-[3px] border-done bg-surface/90 px-7 pb-3 pt-2 text-done shadow-lift ring-[1.5px] ring-done/50 ring-offset-[3px] ring-offset-surface/90">
            <span className="text-[40px] font-extrabold uppercase leading-none tracking-[0.2em]">Done</span>
            <span className="text-center text-[14px] font-bold leading-snug">{shown.title}</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
