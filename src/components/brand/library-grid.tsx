"use client";

import { useState } from "react";
import { pickFileAction, removeBrandImageAction } from "@/app/(app)/brand/actions";
import { deleteLibraryFileAction } from "@/app/(app)/brand-library/actions";
import { ActionButton } from "@/components/action-button";
import { PracticeTag } from "@/components/brand/asset-view";
import { Icon } from "@/components/icons";
import { TEXT_LINK } from "@/components/styles";
import { Chip } from "@/components/ui";

export interface LibraryEntry {
  key: string;
  title: string;
  // The purpose it's for, such as "Facebook cover"; the filters use it
  tag: string;
  detail: string;
  view: string;
  download: string;
  width: number;
  height: number;
  practice: boolean;
  inUse: boolean;
  // A brand image not in use: its id, for "Use this"
  useId?: string;
  // AI flagged something to check
  flagged?: boolean;
  // A generated brand image the owner can remove
  removeId?: string;
  // The owner's own upload
  deleteUploadId?: string;
}

const ALL = "All";

// Every file in one grid, filtered by purpose
export function LibraryGrid({ entries }: { entries: LibraryEntry[] }) {
  const tags = [...new Set(entries.map((entry) => entry.tag))];
  const [tag, setTag] = useState(ALL);
  const shown = tag === ALL || !tags.includes(tag) ? entries : entries.filter((entry) => entry.tag === tag);
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Show pictures for" className="flex flex-wrap gap-2">
        {[ALL, ...tags].map((each) => (
          <button
            key={each}
            type="button"
            aria-pressed={each === tag}
            onClick={() => setTag(each)}
            className={`min-h-11 rounded-full border px-3.5 text-[15px] font-semibold transition ${each === tag ? "border-accent bg-accent text-white" : "border-line bg-surface text-rule hover:border-accent"}`}
          >
            {each}
            <span className="ml-1.5 font-normal opacity-80">{each === ALL ? entries.length : entries.filter((entry) => entry.tag === each).length}</span>
          </button>
        ))}
      </div>
      <ul className="grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-3">
        {shown.map((entry) => (
          <li key={entry.key}>
            <Tile entry={entry} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tile({ entry }: { entry: LibraryEntry }) {
  return (
    <figure className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
      <div className="grid aspect-[4/3] place-items-center border-b border-line bg-soft p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.view} alt={entry.practice ? `Practice preview: ${entry.title}` : entry.title} width={entry.width} height={entry.height} loading="lazy" className="max-h-full w-auto max-w-full object-contain" />
      </div>
      <figcaption className="flex flex-1 flex-col gap-2 p-3">
        <span className="flex flex-wrap gap-1.5">
          <Chip tone="accent">{entry.tag}</Chip>
          {entry.inUse ? (
            <Chip tone="done" icon="check">
              In use
            </Chip>
          ) : null}
          {entry.practice ? <PracticeTag /> : null}
        </span>
        <span className="font-semibold break-words">{entry.title}</span>
        <span className="text-sm text-muted">
          {entry.detail} · {entry.width} × {entry.height}
        </span>
        <span className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
          <a href={entry.view} target="_blank" rel="noopener noreferrer" className={`${TEXT_LINK} inline-flex min-h-11 items-center gap-1.5`}>
            <Icon name="eye" size="sm" />
            View<span className="sr-only"> {entry.title} (opens in a new tab)</span>
          </a>
          <a href={entry.download} download className={`${TEXT_LINK} inline-flex min-h-11 items-center gap-1.5`}>
            <Icon name="download" size="sm" />
            Download<span className="sr-only"> {entry.title}</span>
          </a>
        </span>
        {entry.useId ? (
          <ActionButton
            action={pickFileAction.bind(null, entry.useId)}
            label={`Use for ${entry.tag}`}
            pendingLabel="Saving…"
            confirm={entry.flagged ? "AI flagged something to check on this one. Use it anyway?" : undefined}
          />
        ) : null}
        {entry.removeId ? (
          <ActionButton
            action={removeBrandImageAction.bind(null, entry.removeId)}
            label="Remove"
            pendingLabel="Removing…"
            variant="danger"
            confirm={`Remove this ${entry.tag} picture from your Brand Library? This can’t be undone.`}
          />
        ) : null}
        {entry.deleteUploadId ? (
          <ActionButton
            action={deleteLibraryFileAction.bind(null, entry.deleteUploadId)}
            label="Remove"
            pendingLabel="Removing…"
            variant="danger"
            confirm={`Remove “${entry.title}” from your Brand Library? Products showing it go back to no photo. This can’t be undone.`}
          />
        ) : null}
      </figcaption>
    </figure>
  );
}
