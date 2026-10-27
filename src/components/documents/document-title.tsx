"use client";

import { type FormEvent, useId, useLayoutEffect, useState } from "react";
import { renameDocumentAction } from "@/app/(app)/documents/actions";
import { ALERT, INPUT, PAGE_TITLE, PRIMARY, SECONDARY } from "@/components/styles";

// The document's name as the page heading, with an inline rename
export function DocumentTitle({ documentId, title }: { documentId: string; title: string }) {
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await renameDocumentAction({ documentId, title: value });
      if (!result.ok) setError(result.message);
      else setEditing(false);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className={`${PAGE_TITLE} min-w-0 break-words`}>{title}</h1>
        {editing ? null : (
          <button
            type="button"
            onClick={() => {
              setValue(title);
              setEditing(true);
            }}
            className={SECONDARY}
          >
            Rename<span className="sr-only"> this document</span>
          </button>
        )}
      </div>
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-2">
          <label htmlFor={`${uid}-name`} className="font-semibold">
            New name
          </label>
          <input
            id={`${uid}-name`}
            type="text"
            maxLength={120}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
            className={INPUT}
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={PRIMARY}>
              {pending ? "Saving…" : "Save name"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className={SECONDARY}
            >
              Cancel
            </button>
          </div>
          {error ? (
            <p role="alert" className={ALERT}>
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
