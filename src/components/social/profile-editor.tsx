"use client";

import { useId, useLayoutEffect, useState } from "react";
import { draftSocialBiosAction, saveSocialProfileAction } from "@/app/(app)/social/actions";
import { ActorChip } from "@/components/actor-chip";
import { Icon } from "@/components/icons";
import { AiProgressButton } from "@/components/marketing/ai-progress";
import { ALERT, INPUT, PRIMARY, SECONDARY, TEXT_LINK } from "@/components/styles";
import { Chip } from "@/components/ui";
import { CopyButton } from "@/components/website/copy-button";
import type { MarketingPlatformId } from "@/data/marketing-platforms";
import type { SocialProfileFacts } from "@/data/social-profiles";
import { bioLimit, charCount, checkBio, checkHandle, checkName } from "@/lib/rules/social";
import { MAX_FIELD, type SocialProfile } from "@/lib/social/types";

interface Props {
  platform: MarketingPlatformId;
  platformName: string;
  facts: SocialProfileFacts;
  initial: SocialProfile;
  // Suggested handles, best first
  handles: string[];
  // Owners new to this get a line of explanation under each field
  hints: boolean;
}

// Practice drafts come from built-in rules, not AI
const BY_ACTOR = { ai: "ai", practice: "rule", rule: "rule", owner: "owner" } as const;
const BY_TEXT = { ai: "Drafted by AI", practice: "Practice draft", rule: "Plain draft from your answers", owner: "Written by you" } as const;

function Counter({ count, max, target }: { count: number; max: number | null; target: number }) {
  const over = max !== null && count > max;
  return (
    <span className={`text-sm tabular-nums ${over ? "font-semibold text-danger" : "text-muted"}`}>
      {max !== null ? `${count} / ${max}` : `${count} characters · aim for ${target} or fewer`}
    </span>
  );
}

// The account's name, handle and bio: suggested and drafted for the owner to change and approve
export function ProfileEditor({ platform, platformName, facts, initial, handles, hints }: Props) {
  const uid = useId();
  const [editing, setEditing] = useState(!initial.approvedAt);
  const [name, setName] = useState(initial.name);
  const [handle, setHandle] = useState(initial.handle);
  const [bio, setBio] = useState(initial.bio);
  const [tried, setTried] = useState(false);
  const [pending, setPending] = useState<"save" | "approve" | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  const bare = handle.trim().replace(/^@+/, "");
  const nameProblems = checkName(name, facts);
  const handleProblems = facts.handle ? checkHandle(bare, facts.handle) : [];
  const bioProblems = facts.bio ? checkBio(bio.trim(), facts.bio, platformName) : [];
  // Empty fields only count once the owner tries to approve
  const shown = (problems: string[], value: string) => (tried || value.trim() ? problems : []);
  const changedBio = bio.trim() !== initial.bio;

  async function save(approve: boolean) {
    setTried(approve);
    if (approve && (nameProblems.length || handleProblems.length || bioProblems.length)) return;
    setPending(approve ? "approve" : "save");
    setError(null);
    try {
      const result = await saveSocialProfileAction({ platform, name, handle: bare, bio, approve });
      if (!result.ok) setError(result.message);
      else if (approve) setEditing(false);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-3">
        <dl className="flex flex-col">
          <Row label={facts.name.label} value={name} copy={name} />
          {facts.handle ? <Row label={facts.handle.label} value={`${facts.handle.prefix}${bare}`} copy={bare} /> : null}
          {facts.bio ? <Row label={facts.bio.label} value={bio} copy={bio} /> : null}
        </dl>
        <div className="flex flex-wrap items-center gap-3">
          <Chip tone="done" icon="check">
            Approved
          </Chip>
          {initial.bioBy && facts.bio ? (
            <span className="flex items-center gap-2 text-sm text-muted">
              <ActorChip actor={BY_ACTOR[initial.bioBy]} />
              {BY_TEXT[initial.bioBy]}
            </span>
          ) : null}
          <button type="button" onClick={() => setEditing(true)} className={`min-h-11 ${TEXT_LINK}`}>
            Edit<span className="sr-only"> your {platformName} name and bio</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-semibold">{facts.name.label}</span>
          {facts.name.max !== null ? <Counter count={charCount(name)} max={facts.name.max} target={facts.name.max} /> : null}
        </span>
        {hints ? <span className="text-[15px] text-muted">{facts.name.hint}</span> : null}
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={MAX_FIELD.name} className={INPUT} aria-invalid={shown(nameProblems, name).length > 0} />
        <Problems list={shown(nameProblems, name)} />
      </label>

      {facts.handle ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-handle`} className="font-semibold">
            {facts.handle.label}
          </label>
          {hints ? (
            <p id={`${uid}-handle-help`} className="text-[15px] text-muted">
              The name people type to find you, after the {facts.handle.prefix}. {facts.handle.rules}
            </p>
          ) : (
            <p id={`${uid}-handle-help`} className="text-[15px] text-muted">
              {facts.handle.rules}
            </p>
          )}
          <div className="flex items-stretch">
            <span aria-hidden="true" className="grid place-items-center rounded-l-[10px] border border-r-0 border-field bg-wash px-3 font-semibold text-muted">
              {facts.handle.prefix}
            </span>
            <input
              id={`${uid}-handle`}
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              maxLength={MAX_FIELD.handle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby={`${uid}-handle-help`}
              aria-invalid={shown(handleProblems, bare).length > 0}
              className={`${INPUT} rounded-l-none`}
            />
          </div>
          <Problems list={shown(handleProblems, bare)} />
          {handles.filter((each) => each !== bare).length ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>Ideas:</span>
              {handles
                .filter((each) => each !== bare)
                .map((each) => (
                  <button
                    key={each}
                    type="button"
                    onClick={() => setHandle(each)}
                    className="min-h-9 rounded-lg border border-line-strong bg-surface px-2.5 font-semibold text-ink shadow-soft hover:border-muted"
                  >
                    <span className="sr-only">Use </span>
                    {facts.handle?.prefix}
                    {each}
                  </button>
                ))}
            </div>
          ) : null}
          <p className="text-sm text-muted">First Sale can’t see which names are taken. {platformName} tells you when you sign up.</p>
        </div>
      ) : null}

      {facts.bio ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <label htmlFor={`${uid}-bio`} className="font-semibold">
              {facts.bio.label}
            </label>
            <Counter count={charCount(bio.trim())} max={facts.bio.max} target={bioLimit(facts.bio)} />
          </div>
          {hints ? (
            <p className="text-[15px] text-muted">
              {facts.bio.max === null
                ? `${platformName} doesn’t publish a limit, so First Sale keeps it short.`
                : `A line or two that says what you sell and where. ${platformName} allows ${facts.bio.max} characters.`}
            </p>
          ) : null}
          {initial.bioBy && !changedBio ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <ActorChip actor={BY_ACTOR[initial.bioBy]} />
              {BY_TEXT[initial.bioBy]}
              {initial.bioBy === "ai" || initial.bioBy === "practice" ? ". Read it, then change anything that isn’t right." : null}
            </div>
          ) : null}
          <textarea
            id={`${uid}-bio`}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={MAX_FIELD.bio}
            rows={facts.bio.target > 200 ? 5 : 3}
            aria-invalid={shown(bioProblems, bio).length > 0}
            className={`${INPUT} min-h-24`}
          />
          <Problems list={shown(bioProblems, bio)} />
          {initial.notes.length && !changedBio ? (
            <ul aria-label="What First Sale changed in the draft" className="flex flex-col gap-1 text-sm text-muted">
              {initial.notes.map((note) => (
                <li key={note} className="flex items-start gap-2">
                  <ActorChip actor="rule" />
                  <span className="pt-px">{note}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
      <div className={drafting ? "flex flex-col" : "flex flex-wrap items-start gap-3"}>
        {drafting ? null : (
          <>
            <button type="button" disabled={pending !== null} onClick={() => save(true)} className={PRIMARY}>
              <Icon name="check" size="sm" />
              {pending === "approve" ? "Approving…" : "Approve"}
            </button>
            <button type="button" disabled={pending !== null} onClick={() => save(false)} className={SECONDARY}>
              {pending === "save" ? "Saving…" : "Save without approving"}
            </button>
          </>
        )}
        {facts.bio && pending === null ? (
          <AiProgressButton
            action={() => draftSocialBiosAction({ platform, typed: { name, handle: bare } })}
            label={bio.trim() ? "Draft it again" : "Draft it for me"}
            title={`Drafting your ${platformName} ${facts.bio.label.toLowerCase()}`}
            steps={["Reading your business answers", `Writing for ${platformName}`, `Fitting it to ${platformName}’s limit`]}
            estimateMs={12_000}
            variant={bio.trim() ? "secondary" : "ai"}
            confirm={bio.trim() ? `This replaces your ${facts.bio.label.toLowerCase()} with a new draft. Draft it again?` : undefined}
            onBusy={setDrafting}
          />
        ) : null}
        {initial.approvedAt && !drafting ? (
          <button
            type="button"
            onClick={() => {
              setName(initial.name);
              setHandle(initial.handle);
              setBio(initial.bio);
              setTried(false);
              setEditing(false);
            }}
            className={`min-h-11 ${TEXT_LINK}`}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Problems({ list }: { list: string[] }) {
  if (!list.length) return null;
  return (
    <ul className="flex flex-col gap-1 text-sm font-semibold text-danger">
      {list.map((problem) => (
        <li key={problem} className="flex items-start gap-1.5">
          <Icon name="alert" size="xs" className="mt-0.5" />
          {problem}
        </li>
      ))}
    </ul>
  );
}

function Row({ label, value, copy }: { label: string; value: string; copy: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line py-2.5 last:border-b-0">
      <dt className="w-full text-[15px] text-muted sm:w-32 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 flex-1 font-semibold whitespace-pre-line">{value || <span className="font-normal text-muted">Not set</span>}</dd>
      {copy ? <CopyButton text={copy} label={label.toLowerCase()} /> : null}
    </div>
  );
}
