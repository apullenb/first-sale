"use client";

import { useSearchParams } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { pickFileAction, removeBrandImageAction } from "@/app/(app)/brand/actions";
import { deleteLibraryFileAction } from "@/app/(app)/brand-library/actions";
import { ActionButton } from "@/components/action-button";
import { PracticeTag } from "@/components/brand/asset-view";
import { Icon } from "@/components/icons";
import { INPUT, SECONDARY, TEXT_LINK } from "@/components/styles";
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
  // ISO date it was made or added
  createdAt: string;
  // A brand image not in use: its id, for "Use this"
  useId?: string;
  // AI flagged something to check
  flagged?: boolean;
  // A generated brand image the owner can remove
  removeId?: string;
  // The owner's own upload
  deleteUploadId?: string;
  // Brand images: the kind whose full card is its detail view
  cardKind?: string;
}

const ALL = "All";
const DAY = 24 * 60 * 60 * 1000;
const WHEN = { all: "Any time", week: "This week", month: "This month", older: "Older" } as const;
type When = keyof typeof WHEN;
const PEEK_WIDTH = 360;

const dateText = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// Kept in the address, so a reload shows the same view
function useQuery() {
  const params = useSearchParams();
  const read = (key: string) => params.get(key) ?? "";
  const set = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(window.location.search);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  };
  return { read, set };
}

// Every file in one place: small thumbnails or a list, filtered by purpose and date
// cards: each brand image kind's full card, shown when one of its pictures is opened
export function LibraryGrid({ entries, cards = {} }: { entries: LibraryEntry[]; cards?: Partial<Record<string, ReactNode>> }) {
  const query = useQuery();
  const [now] = useState(() => Date.now());
  const tags = [...new Set(entries.map((entry) => entry.tag))];
  const tag = tags.includes(query.read("tag")) ? query.read("tag") : ALL;
  const view = query.read("view") === "list" ? "list" : "grid";
  const oldest = query.read("sort") === "oldest";
  const when: When = query.read("when") in WHEN ? (query.read("when") as When) : "all";
  // In the address, so an open picture can be linked to; found by key, so it shows as refreshed after an action
  const openKey = query.read("open");
  const open = entries.find((entry) => entry.key === openKey) ?? null;
  const card = open?.cardKind ? cards[open.cardKind] : undefined;
  const [peek, setPeek] = useState<{ entry: LibraryEntry; style: CSSProperties } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [, rerender] = useState(0);

  // Opened from a link or a reload
  const linked = Boolean(open);
  useEffect(() => {
    if (linked && !dialog.current?.open) dialog.current?.showModal();
  }, [linked]);

  const age = (entry: LibraryEntry) => now - new Date(entry.createdAt).getTime();
  const fits = (entry: LibraryEntry) => (when === "week" ? age(entry) <= 7 * DAY : when === "month" ? age(entry) <= 31 * DAY : when === "older" ? age(entry) > 31 * DAY : true);
  const shown = entries
    .filter((entry) => (tag === ALL || entry.tag === tag) && fits(entry))
    .sort((a, b) => (oldest ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));

  // Beside the thumbnail where there's room, always on screen
  function showPeek(entry: LibraryEntry, target: HTMLElement) {
    const box = target.getBoundingClientRect();
    const width = Math.min(PEEK_WIDTH, window.innerWidth - 32);
    const height = (width * entry.height) / entry.width + 72;
    const left = box.right + 12 + width <= window.innerWidth - 16 ? box.right + 12 : box.left - 12 - width >= 16 ? box.left - 12 - width : Math.max(16, Math.min(box.left, window.innerWidth - width - 16));
    const top = Math.max(16, Math.min(box.top, window.innerHeight - height - 16));
    setPeek({ entry, style: { left, top, width } });
  }

  function openLarge(entry: LibraryEntry) {
    setPeek(null);
    query.set("open", entry.key, "");
    dialog.current?.showModal();
  }

  const thumb = (entry: LibraryEntry, size: string) => (
    <button
      type="button"
      onClick={() => openLarge(entry)}
      onMouseEnter={(event) => showPeek(entry, event.currentTarget)}
      onMouseLeave={() => setPeek(null)}
      onFocus={(event) => showPeek(entry, event.currentTarget)}
      onBlur={() => setPeek(null)}
      aria-label={`Open ${entry.title}${entry.inUse ? ", in use" : ""}`}
      className={`relative grid place-items-center overflow-hidden rounded-lg border bg-soft p-1 ${entry.inUse ? "border-accent shadow-[0_0_0_2px_var(--color-accent-tint)]" : "border-line"} ${size}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={entry.view} alt="" width={entry.width} height={entry.height} loading="lazy" className="max-h-full w-auto max-w-full object-contain" />
      {entry.inUse ? (
        <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-done text-white" aria-hidden="true">
          <Icon name="check" size="xs" />
        </span>
      ) : null}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Show pictures for" className="flex flex-wrap gap-2">
        {[ALL, ...tags].map((each) => (
          <button
            key={each}
            type="button"
            aria-pressed={each === tag}
            onClick={() => query.set("tag", each, ALL)}
            className={`min-h-11 rounded-full border px-3.5 text-[15px] font-semibold transition ${each === tag ? "border-accent bg-accent text-white" : "border-line bg-surface text-rule hover:border-accent"}`}
          >
            {each}
            <span className="ml-1.5 font-normal opacity-80">{each === ALL ? entries.length : entries.filter((entry) => entry.tag === each).length}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          When
          <select value={when} onChange={(event) => query.set("when", event.target.value, "all")} className={`${INPUT} min-h-11`}>
            {(Object.keys(WHEN) as When[]).map((key) => (
              <option key={key} value={key}>
                {WHEN[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Sort
          <select value={oldest ? "oldest" : "newest"} onChange={(event) => query.set("sort", event.target.value, "newest")} className={`${INPUT} min-h-11`}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <div role="group" aria-label="View" className="ml-auto flex gap-1">
          {(["grid", "list"] as const).map((each) => (
            <button key={each} type="button" aria-pressed={view === each} onClick={() => query.set("view", each, "grid")} className={`${SECONDARY} ${view === each ? "border-accent text-accent" : ""}`}>
              {each === "grid" ? "Grid" : "List"}
            </button>
          ))}
        </div>
      </div>

      {shown.length ? null : <p className="text-muted">Nothing here for this filter.</p>}
      {view === "grid" ? (
        <ul aria-label="Pictures" className="grid grid-cols-3 gap-2 @md:grid-cols-4 @2xl:grid-cols-6">
          {shown.map((entry) => (
            <li key={entry.key} className="flex flex-col gap-1">
              {thumb(entry, "aspect-square w-full")}
              <span className="truncate text-xs text-muted">{entry.tag}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul aria-label="Pictures" className="flex flex-col divide-y divide-line rounded-xl border border-line">
          {shown.map((entry) => (
            <li key={entry.key} className="flex flex-wrap items-center gap-3 p-2.5">
              {thumb(entry, "size-16 shrink-0")}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Info entry={entry} />
              </div>
              <Actions entry={entry} />
            </li>
          ))}
        </ul>
      )}

      {peek ? (
        <div aria-hidden="true" className="pointer-events-none fixed z-50 hidden flex-col gap-2 rounded-xl border border-line bg-surface p-2 shadow-card [@media(hover:hover)]:flex" style={peek.style}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={peek.entry.view} alt="" width={peek.entry.width} height={peek.entry.height} className="h-auto w-full rounded-lg bg-soft object-contain" />
          <span className="flex flex-col gap-0.5 px-1 text-sm">
            <span className="font-semibold">{peek.entry.tag}</span>
            <span className="text-muted">
              {peek.entry.width} × {peek.entry.height} · {dateText(peek.entry.createdAt)}
            </span>
          </span>
        </div>
      ) : null}

      <dialog ref={dialog} onClose={() => {
          query.set("open", "", "");
          rerender((count) => count + 1);
        }} aria-label={open?.title ?? "Picture"} className="m-auto w-[min(720px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-0 shadow-card backdrop:bg-black/50">
        {open ? (
          <div className="@container flex flex-col gap-3 p-4">
            <form method="dialog" className="flex justify-end">
              <button type="submit" className={SECONDARY}>
                <Icon name="close" size="sm" />
                Close
              </button>
            </form>
            {card ?? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={open.view} alt={open.practice ? `Practice preview: ${open.title}` : open.title} width={open.width} height={open.height} className="max-h-[60vh] w-full rounded-lg bg-soft object-contain" />
                <Info entry={open} />
                <Actions entry={open} />
              </>
            )}
          </div>
        ) : null}
      </dialog>
    </div>
  );
}

function Info({ entry }: { entry: LibraryEntry }) {
  return (
    <>
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
        {entry.detail} · {entry.width} × {entry.height} · {dateText(entry.createdAt)}
      </span>
    </>
  );
}

function Actions({ entry }: { entry: LibraryEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <a href={entry.view} target="_blank" rel="noopener noreferrer" className={`${TEXT_LINK} inline-flex min-h-11 items-center gap-1.5`}>
        <Icon name="eye" size="sm" />
        View<span className="sr-only"> {entry.title} (opens in a new tab)</span>
      </a>
      <a href={entry.download} download className={`${TEXT_LINK} inline-flex min-h-11 items-center gap-1.5`}>
        <Icon name="download" size="sm" />
        Download<span className="sr-only"> {entry.title}</span>
      </a>
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
    </div>
  );
}
