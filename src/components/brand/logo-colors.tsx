"use client";

import { useEffect, useId, useLayoutEffect, useState } from "react";
import { setLogoColorsAction } from "@/app/(app)/brand/actions";
import { ActorChip } from "@/components/actor-chip";
import { Icon } from "@/components/icons";
import { ALERT, PRIMARY, SECONDARY } from "@/components/styles";
import { colorName } from "@/lib/brand/colors";
import { logoColors } from "@/lib/brand/pixels";
import type { PaletteColor } from "@/lib/brand/types";

const MAX = 3;

async function suggestions(src: string): Promise<string[]> {
  const image = new Image();
  image.src = src;
  await image.decode();
  // Small is enough to find the main colors
  const scale = Math.min(1, 400 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return [];
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  return logoColors({ data: data.data, width: data.width, height: data.height }, MAX);
}

// An uploaded logo's colors: found in the picture by code, then picked or changed by the owner
export function LogoColors({ assetId, src, saved }: { assetId: string; src: string; saved: PaletteColor[] }) {
  const uid = useId();
  const [found, setFound] = useState<string[] | null>(null);
  const [picks, setPicks] = useState<string[]>(saved.map((color) => color.hex.toUpperCase()));
  const [adding, setAdding] = useState("#1F3A2E");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useLayoutEffect(
    () => () => {
      setError(null);
      setNote(null);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    suggestions(src)
      .then((hexes) => {
        if (!cancelled) setFound(hexes);
      })
      .catch(() => {
        if (!cancelled) setFound([]);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const changed = picks.join() !== saved.map((color) => color.hex.toUpperCase()).join();
  const toggle = (hex: string) => {
    setNote(null);
    setPicks((current) => (current.includes(hex) ? current.filter((each) => each !== hex) : current.length < MAX ? [...current, hex] : current));
  };

  async function save() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const result = await setLogoColorsAction({ assetId, hexes: picks });
      if (!result.ok) setError(result.message);
      else setNote("Saved. Your brand kit, logo files and website use these colors.");
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const swatch = (hex: string) => <span aria-hidden="true" className="size-6 shrink-0 rounded-md ring-1 ring-ink/15" style={{ backgroundColor: hex }} />;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] text-rule">
        First Sale didn’t draw this logo, so it doesn’t know its colors. Pick up to {MAX}. They’re used for your one-color files, brand images, logo guide and website.
      </p>
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <ActorChip actor="rule" /> Found in your logo by counting its pixels, not by AI.
        </p>
        {found === null ? (
          <p className="text-sm text-muted">Looking at your logo…</p>
        ) : found.length ? (
          <ul className="flex flex-wrap gap-2" aria-label="Colors found in your logo">
            {found.map((hex) => (
              <li key={hex}>
                <button type="button" aria-pressed={picks.includes(hex)} onClick={() => toggle(hex)} className={`${SECONDARY} aria-pressed:border-accent aria-pressed:shadow-[0_0_0_3px_var(--color-accent-tint)]`}>
                  {swatch(hex)}
                  {colorName(hex)} <span className="font-mono text-sm text-muted">{hex}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No clear colors were found. Add them yourself below.</p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={`${uid}-add`} className="flex flex-col gap-1.5">
          <span className="font-semibold">Add a color</span>
          <input id={`${uid}-add`} type="color" value={adding} onChange={(event) => setAdding(event.target.value)} className="h-11 w-20 cursor-pointer rounded-[10px] border border-field bg-surface p-1" />
        </label>
        <button type="button" disabled={picks.length >= MAX || picks.includes(adding.toUpperCase())} onClick={() => toggle(adding.toUpperCase())} className={SECONDARY}>
          <Icon name="plus" size="sm" />
          Add {adding.toUpperCase()}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-semibold">
          Your colors <span className="font-normal text-muted">({picks.length} of {MAX})</span>
        </p>
        {picks.length ? (
          <ul className="flex flex-wrap gap-2">
            {picks.map((hex) => (
              <li key={hex} className="flex items-center gap-2 rounded-lg border border-line bg-surface py-1 pr-1 pl-1.5 text-sm shadow-soft">
                {swatch(hex)}
                {colorName(hex)} <span className="font-mono text-muted">{hex}</span>
                <button type="button" onClick={() => toggle(hex)} className="grid size-9 place-items-center rounded-md text-muted hover:bg-soft hover:text-ink">
                  <Icon name="close" size="sm" />
                  <span className="sr-only">Remove {hex}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">None picked yet.</p>
        )}
      </div>

      <button type="button" disabled={busy || !changed} onClick={save} className={`${PRIMARY} w-fit`}>
        <Icon name="check" size="sm" />
        {busy ? "Saving…" : "Save my colors"}
      </button>
      {note ? (
        <p role="status" className="text-[15px] font-semibold text-done">
          {note}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
