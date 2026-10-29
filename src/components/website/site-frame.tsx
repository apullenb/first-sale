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
