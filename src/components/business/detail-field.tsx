"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { deleteDetailAction, saveDetailAction } from "@/app/(app)/business/actions";
import { ALERT, DANGER, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { DETAILS, displayDetail, type DetailKey, type DetailSpec } from "@/lib/details";

const OFFLINE = "Couldn’t reach First Sale. Check your connection and try again.";
const INPUT_TYPES: Partial<Record<DetailKey, string>> = { business_email: "email", business_phone: "tel" };

interface Props {
  detailKey: DetailKey;
  value: string | null;
  // Where the saved value came from, rendered by the page
  origin?: ReactNode;
}

// One business detail with its explanation, edited in place
export function DetailField({ detailKey, value, origin }: Props) {
  const spec: DetailSpec = DETAILS[detailKey];
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  // Focus moves only after the owner opens or closes the form, not when a kept screen is shown again
  const focusNext = useRef<"field" | "edit" | null>(null);

  useLayoutEffect(() => () => setError(null), []);

  useEffect(() => {
    if (pending) return;
    if (focusNext.current === "field") {
      const form = formRef.current;
      (form?.querySelector<HTMLElement>("input:checked") ?? form?.querySelector<HTMLElement>("input, textarea"))?.focus();
    } else if (focusNext.current === "edit") {
      editRef.current?.focus();
    }
    focusNext.current = null;
  }, [editing, pending]);

  function open() {
    focusNext.current = "field";
    setDraft(value ?? "");
    setError(null);
    setEditing(true);
  }

  function close() {
    focusNext.current = "edit";
    setError(null);
    setEditing(false);
  }

  async function run(kind: "save" | "remove") {
    setPending(kind);
    setError(null);
    try {
      const result = kind === "save" ? await saveDetailAction({ key: detailKey, value: draft }) : await deleteDetailAction(detailKey);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      focusNext.current = "edit";
      setEditing(false);
    } catch {
      setError(OFFLINE);
    } finally {
      setPending(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run("save");
  }

  const labelId = `${uid}-label`;
  const helpId = `${uid}-help`;
  const errorId = `${uid}-error`;
  const describedBy = error ? `${helpId} ${errorId}` : helpId;
  const alert = error ? (
    <p id={errorId} role="alert" className={ALERT}>
      {error}
    </p>
  ) : null;

  return (
    <div className="flex flex-col gap-2">
      <h3 id={labelId} className="font-bold">
        {spec.label}
      </h3>
      <p id={helpId} className="text-[15px] text-rule">
        {spec.help}
      </p>

      {editing ? (
        <form ref={formRef} onSubmit={submit} className="flex flex-col gap-2.5">
          {spec.kind === "choice" ? (
            <fieldset aria-labelledby={labelId} aria-describedby={describedBy} className="flex flex-col">
              {spec.options?.map(([option, text]) => (
                <label key={option} className="flex min-h-11 items-center gap-2.5">
                  <input
                    type="radio"
                    name={`${uid}-choice`}
                    value={option}
                    checked={draft === option}
                    onChange={() => setDraft(option)}
                    className="size-5 accent-accent"
                  />
                  {text}
                </label>
              ))}
            </fieldset>
          ) : spec.kind === "multiline" ? (
            <textarea
              rows={3}
              maxLength={spec.maxLength}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-labelledby={labelId}
              aria-describedby={describedBy}
              aria-invalid={error ? true : undefined}
              className={`${INPUT} resize-y`}
            />
          ) : (
            <input
              type={INPUT_TYPES[detailKey] ?? "text"}
              maxLength={spec.maxLength}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-labelledby={labelId}
              aria-describedby={describedBy}
              aria-invalid={error ? true : undefined}
              className={INPUT}
            />
          )}
          {alert}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending !== null} className={PRIMARY}>
              {pending === "save" ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={close} disabled={pending !== null} className={SECONDARY}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className={value ? "whitespace-pre-line" : "text-muted"}>{value ? displayDetail(detailKey, value) : "Not added yet"}</p>
          {value ? origin : null}
          <div className="flex flex-wrap gap-2">
            <button
              ref={editRef}
              id={`${uid}-edit`}
              type="button"
              onClick={open}
              disabled={pending !== null}
              aria-labelledby={`${uid}-edit ${labelId}`}
              className={SECONDARY}
            >
              {value ? "Edit" : "Add"}
            </button>
            {value ? (
              <button
                id={`${uid}-remove`}
                type="button"
                onClick={() => run("remove")}
                disabled={pending !== null}
                aria-labelledby={`${uid}-remove ${labelId}`}
                className={DANGER}
              >
                {pending === "remove" ? "Removing…" : "Remove"}
              </button>
            ) : null}
          </div>
          {alert}
        </>
      )}
    </div>
  );
}
