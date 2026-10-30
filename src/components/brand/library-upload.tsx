"use client";

import { type FormEvent, useEffect, useId, useLayoutEffect, useState } from "react";
import { uploadLibraryFileAction } from "@/app/(app)/brand-library/actions";
import { Icon } from "@/components/icons";
import { Working } from "@/components/working";
import { ALERT, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { LIBRARY_GROUP_TEXT, type LibraryGroup, MAX_PICTURE_NAME } from "@/lib/brand/library";

const PICKER = `${SECONDARY} w-fit cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent`;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

interface Chosen {
  file: File;
  url: string;
}

// Adds one picture to the Brand Library, sent exactly as it is
export function LibraryUpload({ groups, initialGroup, maxBytes }: { groups: readonly LibraryGroup[]; initialGroup: LibraryGroup; maxBytes: number }) {
  const uid = useId();
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [group, setGroup] = useState<LibraryGroup>(initialGroup);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);
  useEffect(() => (chosen ? () => URL.revokeObjectURL(chosen.url) : undefined), [chosen]);

  function choose(file: File | undefined) {
    setError(null);
    setAdded(null);
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError(/svg/i.test(file.type) ? "SVG files can’t be uploaded. Export a PNG instead." : "Choose a PNG, JPEG or WebP picture.");
    if (file.size > maxBytes) return setError("That file is over 4 MB. Save a smaller copy, then upload that.");
    setChosen({ file, url: URL.createObjectURL(file) });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!chosen) return setError("Choose a picture first.");
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", chosen.file, chosen.file.name);
      form.append("group", group);
      form.append("name", name);
      const result = await uploadLibraryFileAction(form);
      if (!result.ok) return setError(result.message);
      setAdded(`Added to ${LIBRARY_GROUP_TEXT[group].title}.`);
      setChosen(null);
      setName("");
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className={PICKER}>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Icon name="image" size="sm" />
        {chosen ? "Choose a different picture" : "Choose a picture"}
      </label>
      <p className="text-sm text-muted">PNG, JPEG or WebP, up to 4 MB. It’s kept exactly as you upload it.</p>
      {chosen ? (
        <figure className="flex flex-col gap-1.5">
          {/* A local preview of the file about to be sent */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={chosen.url} alt="Preview of the picture you chose" className="max-h-48 w-auto max-w-full self-start rounded-xl border border-line bg-white object-contain" />
          <figcaption className="text-sm break-all text-muted">{chosen.file.name}</figcaption>
        </figure>
      ) : null}

      {groups.length > 1 ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 font-semibold">Where it goes</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {groups.map((each) => (
              <label key={each} className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border border-line-strong bg-surface px-3 py-2.5 shadow-soft has-checked:border-accent has-checked:shadow-[0_0_0_3px_var(--color-accent-tint)]">
                <input type="radio" name={`${uid}-group`} value={each} checked={group === each} onChange={() => setGroup(each)} className="mt-1 accent-(--color-accent)" />
                <span className="flex flex-col">
                  <span className="font-semibold">{LIBRARY_GROUP_TEXT[each].title}</span>
                  <span className="text-sm text-muted">{LIBRARY_GROUP_TEXT[each].help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-name`} className="font-semibold">
          Name <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id={`${uid}-name`} value={name} maxLength={MAX_PICTURE_NAME} onChange={(event) => setName(event.target.value)} placeholder="For example: Our market stall" className={INPUT} />
      </div>

      <button type="submit" disabled={busy || !chosen} className={`${PRIMARY} w-fit`}>
        <Icon name="upload" size="sm" />
        {busy ? "Uploading…" : "Add to my Brand Library"}
      </button>
      <Working active={busy} label="Uploading your picture." />
      {added ? (
        <p role="status" className="flex items-center gap-2 text-[15px] font-semibold text-done">
          <Icon name="check" size="sm" strokeWidth={2.4} />
          {added}
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
