"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { makeImagesAction, setImageMediumAction } from "@/app/(app)/brand/actions";
import { Segmented } from "@/components/marketing/pieces";
import { useRequestKey, Working } from "@/components/working";
import { ALERT } from "@/components/styles";
import { EXAMPLE_IMAGE } from "@/lib/brand/slots";
import { IMAGE_MEDIUMS, type ImageMedium } from "@/lib/brand/types";

const OPTIONS = [
  { value: "photo", label: "Photo", icon: "camera" },
  { value: "illustration", label: "Illustration", icon: "pencil" },
] as const;

function explain(medium: ImageMedium, by: "owner" | "rules"): string {
  if (by === "owner") return medium === "photo" ? "You chose photos for your brand images." : "You chose illustrations for your brand images.";
  return medium === "photo" ? "We picked photos for your brand. Prefer drawings?" : "We picked illustrations, from your brand answers. Prefer photos?";
}

// Photo or illustration for every brand image, set on the example. A switch after the example exists makes a new one.
export function MediumSwitch({ logoId, medium, by, hasExample, cost }: { logoId: string; medium: ImageMedium; by: "owner" | "rules"; hasExample: boolean; cost: string }) {
  const requestKey = useRequestKey();
  const [pending, setPending] = useState<ImageMedium | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  // Kept-mounted screens keep their state
  useLayoutEffect(() => () => setError(null), []);

  async function choose(value: string) {
    const next = IMAGE_MEDIUMS.find((option) => option === value);
    if (!next || next === medium || inFlight.current) return;
    inFlight.current = true;
    setPending(next);
    setError(null);
    try {
      const saved = await setImageMediumAction({ logoId, medium: next });
      if (!saved.ok) return setError(saved.message);
      if (!saved.value.remake) return;
      const made = await makeImagesAction({ requestKey: requestKey.get(), logoId, kinds: [EXAMPLE_IMAGE], change: null });
      if (!made.ok) return setError(made.message);
      requestKey.clear();
    } catch {
      setError("Couldn’t reach SnapStart. Check your connection, then try again.");
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-soft px-3.5 py-3" data-testid="medium-switch">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-rule">{explain(medium, by)}</p>
        <Segmented label="Style of your brand images" options={[...OPTIONS]} value={pending ?? medium} onChange={choose} />
      </div>
      {hasExample ? <p className="text-sm text-muted">Switching makes a new header picture in that style ({cost}). The current one is kept under “Earlier ones”.</p> : null}
      <Working label={`Making your header picture as ${pending === "illustration" ? "an illustration" : "a photo"}… this can take a minute or two`} active={pending !== null && hasExample} />
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
