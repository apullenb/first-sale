"use client";

import { useEffect, useRef, useState } from "react";

const WIDTHS = { computer: 1024, phone: 390 } as const;
const HEIGHT = 672;

// The site at a real screen width, shrunk to fit the space it has
export function SiteFrame({ html, title, device }: { html: string; title: string; device: keyof typeof WIDTHS }) {
  const box = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(0);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setRoom(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const width = WIDTHS[device];
  const scale = room ? Math.min(1, room / width) : 1;
  return (
    <div ref={box} className="relative overflow-hidden" style={{ height: HEIGHT }}>
      <iframe
        title={title}
        srcDoc={html}
        // No scripts can run; same origin only so the owner's own pictures load
        sandbox="allow-same-origin"
        className="absolute top-0 rounded-lg bg-white shadow-card"
        style={{
          width,
          height: HEIGHT / scale,
          left: Math.max(0, (room - width * scale) / 2),
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          visibility: room ? "visible" : "hidden",
        }}
      />
    </div>
  );
}

export function FullScreenPreview({ html, name, onClose }: { html: string; name: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
  }, []);
  return <dialog ref={dialog} onClose={onClose} aria-label={`Full-screen preview of ${name}`} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-white p-0 text-ink backdrop:bg-white">
    <div className="flex h-16 items-center justify-between gap-4 border-b border-line bg-surface px-5">
      <div className="flex min-w-0 items-center gap-3"><span className="truncate font-semibold">{name}</span><span className="text-sm text-muted">Website preview</span></div>
      <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 rounded-lg border border-line px-4 font-semibold hover:bg-soft">Close preview <span aria-hidden="true">×</span></button>
    </div>
    <iframe title={`Full-screen preview of the ${name} website`} srcDoc={html} sandbox="allow-same-origin" className="block h-[calc(100dvh-4rem)] w-full border-0 bg-white" />
  </dialog>;
}
