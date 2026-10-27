"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useLayoutEffect, useState } from "react";
import { uploadPhotoAction } from "@/app/(app)/photos/actions";
import { ALERT, CARD, INPUT, PRIMARY, SECONDARY, SECTION_TITLE } from "@/components/styles";
import { preparePhoto } from "./prepare-photo";
import { Working } from "./working";

const PICKER = `${SECONDARY} flex cursor-pointer items-center has-focus-visible:ring-2 has-focus-visible:ring-accent`;

interface Prepared {
  file: File;
  url: string;
  width: number;
  height: number;
}

export function PhotoUpload({ maxUploadBytes, nameLimit }: { maxUploadBytes: number; nameLimit: number }) {
  const uid = useId();
  const router = useRouter();
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [name, setName] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kept-mounted screens keep their state; clear old errors when hidden
  useLayoutEffect(() => () => setError(null), []);
  useEffect(() => (prepared ? () => URL.revokeObjectURL(prepared.url) : undefined), [prepared]);

  async function choose(file: File | undefined) {
    setError(null);
    if (!file) return;
    setPreparing(true);
    try {
      const result = await preparePhoto(file, maxUploadBytes);
      if (!result.ok) return setError(result.message);
      setPrepared({ file: result.file, url: URL.createObjectURL(result.file), width: result.width, height: result.height });
    } finally {
      setPreparing(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
    if (!prepared) return setError("Choose a photo first.");
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", prepared.file, prepared.file.name);
      form.append("name", name);
      const result = await uploadPhotoAction(form);
      if (!result.ok) return setError(result.message);
      setPrepared(null);
      setName("");
      router.push(`/photos/${result.value}`);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  const busy = preparing || uploading;

  return (
    <section id="upload" aria-labelledby={`${uid}-heading`} className={`${CARD} flex flex-col gap-4`}>
      <div className="flex flex-col gap-1">
        <h2 id={`${uid}-heading`} className={SECTION_TITLE}>
          Add a product photo
        </h2>
        <p className="text-rule">
          An ordinary phone photo is fine. A cluttered table, wrinkled backdrop or dim light can all be fixed. What matters is
          that the product itself is sharp and fully in view.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
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
            Take a photo
          </label>
        </div>
        <p className="text-sm text-muted">
          JPEG, PNG, WebP or a photo straight from your phone. Before it’s sent, the photo is turned the right way up, made
          smaller if it’s large, and stripped of hidden details such as where it was taken.
        </p>

        {preparing ? <p className="text-sm text-muted">Getting your photo ready…</p> : null}

        {prepared ? (
          <figure className="flex flex-col gap-2">
            {/* A local preview of the photo about to be sent */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={prepared.url}
              alt="Preview of the photo you chose"
              width={prepared.width}
              height={prepared.height}
              className="max-h-80 w-auto max-w-full self-start rounded-xl bg-ground object-contain ring-1 ring-ink/10"
            />
            <figcaption className="text-sm text-muted">
              Ready to upload · {prepared.width} × {prepared.height} pixels
            </figcaption>
          </figure>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-name`} className="font-semibold">
            What is it? <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id={`${uid}-name`}
            type="text"
            maxLength={nameLimit}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="For example: Walnut serving board"
            className={INPUT}
          />
        </div>

        <button type="submit" disabled={busy || !prepared} className={`${PRIMARY} self-start`}>
          {uploading ? "Uploading…" : "Upload and check photo"}
        </button>
        <Working active={uploading} label="Uploading your photo and checking it. This usually takes under a minute." />
        {error ? (
          <p role="alert" className={ALERT}>
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
