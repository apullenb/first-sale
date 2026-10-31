"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useId, useLayoutEffect, useRef, useState } from "react";
import type { ActionResult } from "@/app/(app)/business/actions";
import { explainReceivedAction, officialFormAction, pasteDocumentAction, uploadDocumentAction } from "@/app/(app)/documents/actions";
import { uploadRecordAction } from "@/app/(app)/documents/form-actions";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { AI_BUTTON, ALERT, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { Working } from "@/components/working";
import { Card } from "@/components/ui";

// "have": a paper the owner already has or got in the mail; "fill": a form to fill in
export type AddKind = "have" | "fill";
export type AddMode = "upload" | "paste" | "official";

const KINDS: { value: AddKind; label: string }[] = [
  { value: "have", label: "A document I have or got in the mail" },
  { value: "fill", label: "A form I need to fill in" },
];

const KEPT_ROLES = [
  ["mail", "A letter or notice I got"],
  ["approval", "A registration, license or permit I already have"],
  ["receipt", "A receipt or filing confirmation"],
  ["supporting", "Something else"],
] as const;

const MODES: { value: AddMode; label: string }[] = [
  { value: "upload", label: "Upload a PDF or photo" },
  { value: "paste", label: "Paste the form’s text" },
  { value: "official", label: "Get an official form from a .gov link" },
];

// Photos over this size or width are redrawn as JPEG before upload
const SHRINK_OVER_BYTES = 3_500_000;
const MAX_WIDTH = 2400;

const CHOICES = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-2";
const CHOICE =
  "flex min-h-[50px] cursor-pointer items-center gap-3 rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 font-semibold leading-snug shadow-soft transition hover:border-muted has-checked:border-accent has-checked:ring-[3px] has-checked:ring-accent-tint has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent";
const LABEL = "text-[15.5px] font-semibold";
const HINT = "text-[14.5px] text-muted";

interface Props {
  steps: { id: string; title: string }[];
  initialStep: string | null;
  initialKind: AddKind;
  initialMode: AddMode;
  acceptedTypes: string[];
  maxUploadBytes: number;
  maxPasteChars: number;
  // Where Close goes; no Close button without it
  closeHref?: string;
}

export function AddFormPanel({ steps, initialStep, initialKind, initialMode, acceptedTypes, maxUploadBytes, maxPasteChars, closeHref }: Props) {
  const uid = useId();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  // One per file chosen, kept for retries, so a lost connection can't save it twice
  const requestKey = useRef<string | null>(null);
  const [kind, setKind] = useState<AddKind>(initialKind);
  const [role, setRole] = useState<(typeof KEPT_ROLES)[number][0]>("mail");
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
    const explain = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "explain";
    try {
      let result: ActionResult<string>;
      if (kind === "have") {
        if (!file) return setError("Choose a file to upload.");
        setStatus("Getting your file ready…");
        const prepared = await prepareUpload(file, acceptedTypes, maxUploadBytes);
        if (!prepared.ok) return setError(prepared.message);
        const form = new FormData();
        form.append("file", prepared.file, prepared.file.name);
        form.append("role", role);
        form.append("requestKey", (requestKey.current ??= crypto.randomUUID()));
        if (stepId) form.append("stepId", stepId);
        setStatus("Saving it to your library…");
        result = await uploadRecordAction(form);
        if (result.ok && explain) {
          setStatus("Reading it and writing an explanation… this can take a minute");
          // A failed explanation shows on the document's page, with a way to try again
          await explainReceivedAction(result.value);
        }
      } else if (mode === "upload") {
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
      requestKey.current = null;
      if (fileInput.current) fileInput.current.value = "";
      router.push(`/documents/${result.value}`);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setStatus(null);
    }
  }

  return (
    <div id="add-form" className="scroll-mt-4">
      <Card
        title="Add to your library"
        icon="upload"
        id={`${uid}-heading`}
        action={
          closeHref ? (
            <Link href={closeHref} className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2.5 text-[15px] font-semibold text-muted hover:bg-wash hover:text-ink">
              <Icon name="close" size="sm" />
              Close
            </Link>
          ) : null
        }
      >
        <div className="flex flex-col gap-2.5">
          {kind === "have" ? (
            <p className="text-rule">
              Upload papers you already have, like your LLC certificate or the IRS letter with your EIN (tax ID number), or a letter you got in the mail and aren’t sure about. First Sale can
              explain what it is, what it means, and anything you need to do.
            </p>
          ) : (
            <p className="text-rule">
              Add a form you need to fill in, such as a registration or permit application. First Sale reads it, explains it, and helps you draft answers.
            </p>
          )}
        </div>

        <form onSubmit={submit} className="mt-2 flex flex-col gap-5 border-t border-line pt-5">
          <fieldset className="flex flex-col gap-2">
            <legend className={`mb-2 ${LABEL}`}>What are you adding?</legend>
            <div className={CHOICES}>
              {KINDS.map((option) => (
                <label key={option.value} className={CHOICE}>
                  <input
                    type="radio"
                    name={`${uid}-kind`}
                    value={option.value}
                    checked={kind === option.value}
                    onChange={() => {
                      setKind(option.value);
                      setError(null);
                    }}
                    className="size-[18px] shrink-0 accent-accent"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          {kind === "have" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-role`} className={LABEL}>
                What is it?
              </label>
              <select id={`${uid}-role`} value={role} onChange={(event) => {
                  setRole(event.target.value as typeof role);
                  requestKey.current = null;
                }} className={INPUT}>
                {KEPT_ROLES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className={`mb-2 ${LABEL}`}>How would you like to add it?</legend>
              <div className={CHOICES}>
                {MODES.map((option) => (
                  <label key={option.value} className={CHOICE}>
                    <input
                      type="radio"
                      name={`${uid}-mode`}
                      value={option.value}
                      checked={mode === option.value}
                      onChange={() => {
                        setMode(option.value);
                        setError(null);
                      }}
                      className="size-[18px] shrink-0 accent-accent"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {kind === "have" || mode === "upload" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-file`} className={LABEL}>
                {kind === "have" ? "The document, as a PDF or photo" : "The form, as a PDF or photo"}
              </label>
              <input
                id={`${uid}-file`}
                ref={fileInput}
                type="file"
                accept={acceptedTypes.join(",")}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  requestKey.current = null;
                }}
                className="min-h-12 w-full rounded-[10px] border border-dashed border-line-strong bg-soft px-3 py-2.5 text-base shadow-soft file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:font-semibold file:text-ink focus-visible:border-accent"
                aria-describedby={`${uid}-file-help`}
              />
              <div id={`${uid}-file-help`} className={`flex flex-col gap-1 ${HINT}`}>
                <p>PDFs and photos (PNG, JPEG or WebP), up to {maxMb}. Large photos are made smaller before they’re sent.</p>
                <p>
                  iPhone photos saved as HEIC only work if your browser converts them. If yours doesn’t, take a screenshot of
                  the photo and upload that.
                </p>
              </div>
            </div>
          ) : null}

          {kind === "fill" && mode === "paste" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${uid}-title`} className={LABEL}>
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
                <label htmlFor={`${uid}-text`} className={LABEL}>
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
                <p id={`${uid}-text-help`} className={HINT}>
                  Copy the form’s questions and instructions from the website or document, and paste them here. Up to{" "}
                  {maxPasteChars.toLocaleString("en-US")} characters ({text.length.toLocaleString("en-US")} so far).
                </p>
              </div>
            </>
          ) : null}

          {kind === "fill" && mode === "official" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-url`} className={LABEL}>
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
              <p id={`${uid}-url-help`} className={HINT}>
                First Sale only fetches PDF forms from official government websites, usually ending in .gov. If the form is
                filled in online, paste its questions instead.
              </p>
            </div>
          ) : null}

          {steps.length ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-step`} className={LABEL}>
                Which step in your plan is it for? <span className="font-normal text-muted">(optional)</span>
              </label>
              <select
                id={`${uid}-step`}
                value={stepId}
                onChange={(event) => {
                  setStepId(event.target.value);
                  requestKey.current = null;
                }}
                className={INPUT}
              >
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
            {kind === "have" ? (
              <div className="flex flex-wrap gap-2">
                <button type="submit" value="explain" disabled={pending} className={AI_BUTTON}>
                  <Icon name="sparkles" size="sm" />
                  {pending ? "Working…" : "Save and explain it"}
                </button>
                <button type="submit" value="save" disabled={pending} className={SECONDARY}>
                  Just save it
                </button>
              </div>
            ) : (
              <button type="submit" disabled={pending} className={PRIMARY}>
                <Icon name="upload" size="sm" />
                {pending ? "Adding…" : "Add this form"}
              </button>
            )}
            <Working label={status ?? ""} active={pending} />
            {error ? (
              <p role="alert" className={ALERT}>
                {error}
              </p>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
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
