"use client";

import { type FormEvent, useEffect, useId, useLayoutEffect, useState } from "react";
import { itemFromPhotoAction } from "@/app/(app)/products/actions";
import { Icon } from "@/components/icons";
import { RUNNING_ELSEWHERE, useJobWatch } from "@/components/job-watch";
import { preparePhoto } from "@/components/photos/prepare-photo";
import { AI_BUTTON, ALERT, INPUT, SECONDARY } from "@/components/styles";
import { IconTile } from "@/components/ui";
import { Working } from "@/components/working";
import type { ItemKind } from "@/lib/rules/products";

const PICKER = `${SECONDARY} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent`;

// A photo of a product, or of the owner's work, becomes a suggested item with a drafted name and description
export function FromPhoto({ kinds, maxUploadBytes, nameLimit }: { kinds: ItemKind[]; maxUploadBytes: number; nameLimit: number }) {
  const uid = useId();
  const [prepared, setPrepared] = useState<{ file: File; url: string } | null>(null);
  const [kind, setKind] = useState<ItemKind>(kinds[0] ?? "product");
  const [hint, setHint] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const job = useJobWatch();
  useLayoutEffect(() => () => setError(null), []);
  useEffect(() => (prepared ? () => URL.revokeObjectURL(prepared.url) : undefined), [prepared]);
  const both = kinds.length > 1;
  const onlyServices = !both && kind === "service";

  async function choose(file: File | undefined) {
    setError(null);
    if (!file) return;
    setPreparing(true);
    try {
      const result = await preparePhoto(file, maxUploadBytes);
      if (!result.ok) return setError(result.message);
      setPrepared({ file: result.file, url: URL.createObjectURL(result.file) });
    } finally {
      setPreparing(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading || job.watching) return;
    if (!prepared) return setError("Choose a photo first.");
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", prepared.file, prepared.file.name);
      form.append("hint", hint);
      form.append("kind", kind);
      const result = await itemFromPhotoAction(form);
      if (!result.ok && result.busy) return job.watch([result.busy]);
      if (!result.ok) return setError(result.message);
      setPrepared(null);
      setHint("");
    } catch {
      setError("Couldn’t reach SnapStart. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  const busy = preparing || uploading || job.watching;
  return (
    <section aria-labelledby={`${uid}-heading`} className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
        <IconTile icon="camera" tone="ai" />
        <h2 id={`${uid}-heading`} className="min-w-0 flex-1 text-base font-bold">
          Start from a photo
        </h2>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4 p-5">
        <p className="text-rule">
          {onlyServices ? "Upload a photo of your work" : both ? "Upload a photo of a product, or of your work" : "Upload a photo of a product"} and get a drafted name and description to check. The photo stays with it as its photo.
        </p>
        {both ? (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-1 w-full font-semibold">What does it show?</legend>
            {kinds.map((each) => (
              <label key={each} className={`${PICKER} has-checked:border-accent has-checked:bg-accent-tint`}>
                <input type="radio" name={`${uid}-kind`} checked={kind === each} onChange={() => setKind(each)} className="sr-only" />
                {each === "product" ? "Something I sell" : "My work, for a service"}
              </label>
            ))}
          </fieldset>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <label className={PICKER}>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                void choose(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <Icon name="image" size="sm" />
            Choose a photo
          </label>
          <label className={PICKER}>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                void choose(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <Icon name="camera" size="sm" />
            Take a photo
          </label>
        </div>
        {preparing ? <p className="text-sm text-muted">Getting your photo ready…</p> : null}
        {prepared ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={prepared.url} alt="Preview of the photo you chose" className="max-h-60 w-auto max-w-full self-start rounded-xl border border-line bg-soft object-contain" />
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-hint`} className="font-semibold">
            What is it? <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id={`${uid}-hint`} value={hint} maxLength={nameLimit} onChange={(event) => setHint(event.target.value)} placeholder={onlyServices ? "For example: Full groom" : "For example: Walnut serving board"} className={INPUT} />
        </div>
        <button type="submit" disabled={busy || !prepared} className={`${AI_BUTTON} self-start`}>
          <Icon name="sparkles" size="sm" />
          {uploading ? "Reading your photo…" : "Draft a name and description"}
        </button>
        <Working active={uploading || job.watching} label={job.watching ? RUNNING_ELSEWHERE : "Uploading your photo and drafting a name and description. This usually takes under a minute."} />
        {error ? (
          <p role="alert" className={ALERT}>
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
