"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useLayoutEffect, useState } from "react";
import { uploadPhotoAction } from "@/app/(app)/photos/actions";
import { Icon } from "@/components/icons";
import { ALERT, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { IconTile } from "@/components/ui";
import { preparePhoto } from "./prepare-photo";
import { Working } from "@/components/working";

const PICKER = `${SECONDARY} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent`;

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
      setError("Couldn’t reach SnapStart. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  const busy = preparing || uploading;

  return (
    <section id="upload" aria-labelledby={`${uid}-heading`} className="scroll-mt-6 overflow-hidden rounded-[14px] border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
        <IconTile icon="upload" />
        <h2 id={`${uid}-heading`} className="min-w-0 flex-1 text-base font-bold">
          Add a product photo
        </h2>
      </div>
      <div className="flex flex-col gap-4 p-5">
        <p className="text-rule">
          An ordinary phone photo is fine. A cluttered table, wrinkled backdrop or dim light can all be fixed. What matters is
          that the product itself is sharp and fully in view.
        </p>
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
                className="max-h-80 w-auto max-w-full self-start rounded-xl border border-line bg-soft object-contain"
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
            <Icon name="upload" size="sm" />
            {uploading ? "Uploading…" : "Upload and check photo"}
          </button>
          <Working active={uploading} label="Uploading your photo and checking it. This usually takes under a minute." />
          {error ? (
            <p role="alert" className={ALERT}>
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
