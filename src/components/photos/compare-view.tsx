"use client";

import { useId, useState } from "react";

interface Shown {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
}

const FRAME = "rounded-xl bg-ground object-contain ring-1 ring-ink/10";
const TOGGLE =
  "min-h-11 rounded-lg border border-field bg-surface px-4 font-semibold aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent-ink";

// The original and an edit side by side, or stacked under a slider
export function CompareView({ original, edited }: { original: Shown; edited: Shown }) {
  const uid = useId();
  const [mode, setMode] = useState<"side" | "slider">("side");
  const [split, setSplit] = useState(50);

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="How to compare" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={mode === "side"} onClick={() => setMode("side")} className={TOGGLE}>
          Side by side
        </button>
        <button type="button" aria-pressed={mode === "slider"} onClick={() => setMode("slider")} className={TOGGLE}>
          Comparison slider
        </button>
      </div>

      {mode === "side" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[original, edited].map((shown) => (
            <figure key={shown.src} className="flex flex-col gap-1.5">
              {/* Private files served by this app; next/image would cache them */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shown.src} alt={shown.alt} width={shown.width} height={shown.height} className={`h-auto w-full ${FRAME}`} />
              <figcaption className="text-sm text-muted">{shown.caption}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className={`relative w-full overflow-hidden ${FRAME}`} style={{ aspectRatio: `${edited.width} / ${edited.height}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={edited.src} alt={edited.alt} className="absolute inset-0 size-full object-contain" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={original.src}
              alt={original.alt}
              className="absolute inset-0 size-full bg-ground object-contain"
              style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
            />
            <span aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-surface shadow" style={{ left: `${split}%` }} />
          </div>
          <div className="flex items-center justify-between text-sm text-muted">
            <span>← {original.caption}</span>
            <span>{edited.caption} →</span>
          </div>
          <label htmlFor={`${uid}-split`} className="sr-only">
            How much of the original to show
          </label>
          <input
            id={`${uid}-split`}
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(event) => setSplit(Number(event.target.value))}
            aria-valuetext={`${split}% original`}
            className="h-11 w-full accent-accent"
          />
        </div>
      )}
    </div>
  );
}
