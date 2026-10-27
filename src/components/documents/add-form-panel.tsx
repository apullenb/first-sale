"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useId, useLayoutEffect, useRef, useState } from "react";
import type { ActionResult } from "@/app/(app)/business/actions";
import { officialFormAction, pasteDocumentAction, uploadDocumentAction } from "@/app/(app)/documents/actions";
import { ActorChip } from "@/components/actor-chip";
import { ALERT, CARD, INPUT, PRIMARY, SECTION_TITLE } from "@/components/styles";

export type AddMode = "upload" | "paste" | "official";

const MODES: { value: AddMode; label: string }[] = [
  { value: "upload", label: "Upload a PDF or photo" },
  { value: "paste", label: "Paste the form’s text" },
  { value: "official", label: "Get an official form from a .gov link" },
];

// Photos over this size or width are redrawn as JPEG before upload
const SHRINK_OVER_BYTES = 3_500_000;
const MAX_WIDTH = 2400;

interface Props {
  steps: { id: string; title: string }[];
  initialStep: string | null;
  initialMode: AddMode;
  acceptedTypes: string[];
  maxUploadBytes: number;
  maxPasteChars: number;
}

export function AddFormPanel({ steps, initialStep, initialMode, acceptedTypes, maxUploadBytes, maxPasteChars }: Props) {
  const uid = useId();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<AddMode>(initialMode);
  const [stepId, setStepId] = useState(initialStep ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  const maxMb = `${Math.round(maxUploadBytes / 1_000_000)} MB`;
  const pending = status !== null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      let result: ActionResult<string>;
      if (mode === "upload") {
        if (!file) return setError("Choose a file to upload.");
        setStatus("Getting your file ready…");
        const prepared = await prepareUpload(file, acceptedTypes, maxUploadBytes);
        if (!prepared.ok) return setError(prepared.message);
        const form = new FormData();
        form.append("file", prepared.file, prepared.file.name);
        if (stepId) form.append("stepId", stepId);
        setStatus("Reading your form… this can take a minute");
        result = await uploadDocumentAction(form);
      } else if (mode === "paste") {
        if (text.trim().length < 20) return setError("Paste the form’s text, including its questions.");
        setStatus("Reading your form… this can take a minute");
        result = await pasteDocumentAction({ title, text, stepId });
      } else {
        if (!url.trim()) return setError("Paste the link to the form.");
        setStatus("Getting the form and reading it… this can take a minute");
        result = await officialFormAction({ url, stepId });
      }
      if (!result.ok) return setError(result.message);
      setFile(null);
      setTitle("");
      setText("");
      setUrl("");
      if (fileInput.current) fileInput.current.value = "";
      router.push(`/documents/${result.value}`);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setStatus(null);
    }
  }

  return (
    <section aria-labelledby={`${uid}-heading`} id="add-form" className={`${CARD} flex flex-col gap-4`}>
      <div className="flex flex-col gap-1.5">
        <h2 id={`${uid}-heading`} className={SECTION_TITLE}>
          Add a form
        </h2>
        <p className="text-rule">
          Add a form you need to fill in, such as a registration or permit application. First Sale reads it, explains
          it, and helps you draft answers.
        </p>
        <p className="flex items-start gap-2.5 text-sm text-rule">
          <ActorChip actor="ai" />
          <span>AI reads the form and finds the blanks to fill in. First Sale never files or submits anything for you.</span>
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">How would you like to add it?</legend>
          <div className="flex flex-wrap gap-2">
            {MODES.map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-field bg-surface px-3.5 font-semibold has-checked:border-accent has-checked:bg-accent-tint has-checked:text-accent-ink has-focus-visible:ring-2 has-focus-visible:ring-accent"
              >
                <input
                  type="radio"
                  name={`${uid}-mode`}
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => {
                    setMode(option.value);
                    setError(null);
                  }}
                  className="size-4 accent-accent"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        {mode === "upload" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-file`} className="font-semibold">
              The form, as a PDF or photo
            </label>
            <input
              id={`${uid}-file`}
              ref={fileInput}
              type="file"
              accept={acceptedTypes.join(",")}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="min-h-12 w-full rounded-lg border border-field bg-surface px-3 py-2.5 text-base file:mr-3 file:min-h-9 file:rounded-md file:border-0 file:bg-accent-tint file:px-3 file:font-semibold file:text-accent-ink"
              aria-describedby={`${uid}-file-help`}
            />
            <div id={`${uid}-file-help`} className="flex flex-col gap-1 text-sm text-muted">
              <p>PDFs and photos (PNG, JPEG or WebP), up to {maxMb}. Large photos are made smaller before they’re sent.</p>
              <p>
                iPhone photos saved as HEIC only work if your browser converts them. If yours doesn’t, take a screenshot of
                the photo and upload that.
              </p>
            </div>
          </div>
        ) : null}

        {mode === "paste" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-title`} className="font-semibold">
                Name for this form <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id={`${uid}-title`}
                type="text"
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="For example: Sales tax permit application"
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-text`} className="font-semibold">
                The form’s text
              </label>
              <textarea
                id={`${uid}-text`}
                rows={8}
                maxLength={maxPasteChars}
                value={text}
                onChange={(event) => setText(event.target.value)}
                className={INPUT}
                aria-describedby={`${uid}-text-help`}
              />
              <p id={`${uid}-text-help`} className="text-sm text-muted">
                Copy the form’s questions and instructions from the website or document, and paste them here. Up to{" "}
                {maxPasteChars.toLocaleString("en-US")} characters ({text.length.toLocaleString("en-US")} so far).
              </p>
            </div>
          </>
        ) : null}

        {mode === "official" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-url`} className="font-semibold">
              Link to the form
            </label>
            <input
              id={`${uid}-url`}
              type="url"
              inputMode="url"
              maxLength={2000}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.example.gov/forms/application.pdf"
              className={INPUT}
              aria-describedby={`${uid}-url-help`}
            />
            <p id={`${uid}-url-help`} className="text-sm text-muted">
              First Sale only fetches PDF forms from official government websites, usually ending in .gov. If the form is
              filled in online, paste its questions instead.
            </p>
          </div>
        ) : null}

        {steps.length ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-step`} className="font-semibold">
              Which step in your plan is it for? <span className="font-normal text-muted">(optional)</span>
            </label>
            <select id={`${uid}-step`} value={stepId} onChange={(event) => setStepId(event.target.value)} className={INPUT}>
              <option value="">Not linked to a step</option>
              {steps.map((step) => (
                <option key={step.id} value={step.id}>
                  {step.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex flex-col items-start gap-2">
          <button type="submit" disabled={pending} className={PRIMARY}>
            {pending ? "Adding…" : "Add this form"}
          </button>
          <p role="status" className={pending ? "text-sm text-muted" : "sr-only"}>
            {status ?? ""}
          </p>
          {error ? (
            <p role="alert" className={ALERT}>
              {error}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

type Prepared = { ok: true; file: File } | { ok: false; message: string };

// PDFs go as they are; photos that are too big or wide are redrawn as JPEG in the browser
async function prepareUpload(file: File, acceptedTypes: string[], maxBytes: number): Promise<Prepared> {
  const tooBig = "That file is over 4 MB. Try a smaller scan, or take a photo of each page.";
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return file.size > maxBytes ? { ok: false, message: tooBig } : { ok: true, file };
  }
  const accepted = acceptedTypes.includes(file.type);
  if (!accepted && !file.type.startsWith("image/") && !/\.(png|jpe?g|webp|heic|heif)$/i.test(file.name)) {
    return { ok: false, message: "First Sale can read PDFs and photos (PNG, JPEG or WebP). Try one of those." };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    if (accepted) return file.size > maxBytes ? { ok: false, message: tooBig } : { ok: true, file };
    return {
      ok: false,
      message: "Your browser can’t convert this photo (often an iPhone HEIC photo). Take a screenshot of it and upload that instead.",
    };
  }

  try {
    if (accepted && file.size <= SHRINK_OVER_BYTES && bitmap.width <= MAX_WIDTH) return { ok: true, file };
    const scale = Math.min(1, MAX_WIDTH / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return { ok: false, message: "Your browser couldn’t make this photo smaller. Try a smaller photo." };
    // JPEG has no transparency
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= SHRINK_OVER_BYTES) {
        const name = `${file.name.replace(/\.[a-z0-9]{1,5}$/i, "") || "photo"}.jpg`;
        return { ok: true, file: new File([blob], name, { type: "image/jpeg" }) };
      }
    }
    return { ok: false, message: "That photo is still over 4 MB after making it smaller. Try a photo of one page at a time." };
  } finally {
    bitmap.close();
  }
}
