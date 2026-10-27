"use client";

import { useId, useState } from "react";
import type { Guide } from "@/lib/brand/sizes";

interface Props {
  src: string;
  alt: string;
  width: number;
  height: number;
  guides: Guide[];
  // Profile pictures: shows the circle crop
  circle?: boolean;
}

// The picture with optional boxes showing what each platform keeps, crops or covers
export function GuidedImage({ src, alt, width, height, guides, circle }: Props) {
  const uid = useId();
  const [show, setShow] = useState(true);
  const hasGuides = guides.length > 0 || circle;

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative w-full overflow-hidden rounded-xl bg-ground ring-1 ring-ink/10" style={{ aspectRatio: `${width} / ${height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={width} height={height} className="absolute inset-0 size-full object-cover" />
        {show && circle ? <span aria-hidden="true" className="absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(28,35,33,0.45)] ring-2 ring-white" /> : null}
        {show
          ? guides.map((guide) => (
              <span
                key={guide.label}
                aria-hidden="true"
                className={
                  guide.tone === "keep"
                    ? "absolute border-2 border-dashed border-white shadow-[0_0_0_1px_rgba(28,35,33,0.6)]"
                    : "absolute bg-ink/45"
                }
                style={{ left: `${guide.x * 100}%`, top: `${guide.y * 100}%`, width: `${guide.w * 100}%`, height: `${guide.h * 100}%` }}
              />
            ))
          : null}
      </div>
      {hasGuides ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-guides`} className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-sm font-semibold">
            <input id={`${uid}-guides`} type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} className="size-4 accent-accent" />
            Show what gets cropped
          </label>
          {show ? (
            <ul className="flex flex-col gap-1 text-sm text-muted">
              {circle ? <li>Outside the circle gets cropped off on profile pictures.</li> : null}
              {guides.map((guide) => (
                <li key={guide.label} className="flex items-center gap-2">
                  <span aria-hidden="true" className={guide.tone === "keep" ? "inline-block h-3 w-5 shrink-0 border-2 border-dashed border-muted" : "inline-block h-3 w-5 shrink-0 bg-ink/45"} />
                  {guide.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </figure>
  );
}
