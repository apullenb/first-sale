"use client";

import { type FormEvent, useEffect, useId, useLayoutEffect, useState } from "react";
import { uploadLogoAction } from "@/app/(app)/logo/actions";
import { Icon } from "@/components/icons";
import { useRequestKey, Working } from "@/components/photos/working";
import { ALERT, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { MAX_LOGO_WORDS, SMALL_LOGO_SIDE } from "@/lib/brand/library";

const PICKER = `${SECONDARY} w-fit cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent`;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

interface Chosen {
  file: File;
  url: string;
  width: number;
  height: number;
}

// The owner's own logo, sent exactly as it is: nothing is resized or converted
export function LogoUpload({ businessName, maxBytes, replacing }: { businessName: string; maxBytes: number; replacing: boolean }) {
  const uid = useId();
  const requestKey = useRequestKey();
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [words, setWords] = useState(businessName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useLayoutEffect(() => () => setError(null), []);
  useEffect(() => (chosen ? () => URL.revokeObjectURL(chosen.url) : undefined), [chosen]);

  async function choose(file: File | undefined) {
    setError(null);
    setDone(false);
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError(/svg/i.test(file.type) ? "SVG files can’t be uploaded. Export a PNG from your design app instead." : "Choose a PNG, JPEG or WebP file.");
    if (file.size > maxBytes) return setError("That file is over 4 MB. Save a smaller copy, then upload that.");
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      URL.revokeObjectURL(url);
      return setError("That file couldn’t be opened as a picture. Try saving it again as a PNG.");
    }
    requestKey.clear();
    setChosen({ file, url, width: image.naturalWidth, height: image.naturalHeight });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!chosen) return setError("Choose your logo file first.");
    if (replacing && !window.confirm("Use this logo instead? Your logo versions and brand pictures were made from your current logo, so they’ll be cleared from your brand kit.")) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", chosen.file, chosen.file.name);
      form.append("words", words);
      form.append("requestKey", requestKey.get());
      const result = await uploadLogoAction(form);
      if (!result.ok) return setError(result.message);
      requestKey.clear();
      setChosen(null);
      setDone(true);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-line bg-soft p-4">
      <label className={PICKER}>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Icon name="upload" size="sm" />
        {chosen ? "Choose a different file" : "Choose your logo file"}
      </label>
      <p className="text-sm text-muted">PNG, JPEG or WebP, up to 4 MB. A PNG with a see-through or plain white background works best. It’s kept exactly as you upload it, including any hidden details saved in the file, such as where a photo was taken.</p>

      {chosen ? (
        <figure className="flex flex-col gap-2">
          {/* A local preview of the file about to be sent */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={chosen.url} alt="Preview of your logo" width={chosen.width} height={chosen.height} className="max-h-56 w-auto max-w-full self-start rounded-xl border border-line bg-white object-contain p-2" />
          <figcaption className="text-sm text-muted">
            {chosen.file.name} · {chosen.width} × {chosen.height} pixels
          </figcaption>
          {Math.min(chosen.width, chosen.height) < SMALL_LOGO_SIDE ? (
            <p className="text-sm text-check">This is a small file, so versions made from it may look soft. Use a larger copy if you have one.</p>
          ) : null}
        </figure>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-words`} className="font-semibold">
          Words in your logo, spelled exactly
        </label>
        <input id={`${uid}-words`} value={words} maxLength={MAX_LOGO_WORDS} onChange={(event) => setWords(event.target.value)} className={INPUT} />
        <p className="text-sm text-muted">AI checks the spelling of each version made from your logo against these. Leave it empty if your logo has no words.</p>
      </div>

      <button type="submit" disabled={busy || !chosen} className={`${PRIMARY} w-fit`}>
        <Icon name="upload" size="sm" />
        {busy ? "Uploading…" : "Upload and use this logo"}
      </button>
      <Working active={busy} label="Uploading your logo." />
      {done ? (
        <p role="status" className="flex items-center gap-2 text-[15px] font-semibold text-done">
          <Icon name="check" size="sm" strokeWidth={2.4} />
          Your logo is uploaded and chosen.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
