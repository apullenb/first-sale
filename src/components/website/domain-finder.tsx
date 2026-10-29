"use client";

import { useId, useLayoutEffect, useState } from "react";
import { checkDomainAction, chooseDomainAction } from "@/app/(app)/website/actions";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { Done } from "@/components/marketing/pieces";
import { ALERT, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { Chip } from "@/components/ui";
import type { DomainCheck } from "@/lib/website/types";

interface Props {
  ideas: string[];
  checks: DomainCheck[];
  chosen: string | null;
}

const STATUS = {
  available: { label: "Not registered yet", tone: "done" },
  taken: { label: "Already taken", tone: "gray" },
  unknown: { label: "Couldn’t check", tone: "warn" },
} as const;

// Ideas from the business name, plus any address the owner types, checked against the official registry
export function DomainFinder({ ideas, checks, chosen }: Props) {
  const uid = useId();
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  const checked = new Map([...checks].reverse().map((check) => [check.domain, check]));
  const list = [...new Set([...ideas, ...checks.map((check) => check.domain)])];

  async function run(key: string, action: () => Promise<{ ok: boolean; message?: string }>) {
    setPending(key);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) setError(result.message ?? "That didn’t work. Try again.");
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {chosen ? (
        <Done>
          <span className="font-normal">
            Your web address: <strong className="break-all">{chosen}</strong>. Buy it when you set up your site; until then, someone else could.
          </span>
        </Done>
      ) : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run("typed", () => checkDomainAction(typed));
        }}
      >
        <label htmlFor={`${uid}-domain`} className="font-semibold">
          Have an idea? Check it
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={`${uid}-domain`}
            type="text"
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={70}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="yourbusiness.com"
            className={`${INPUT} min-w-0 flex-1 basis-56`}
          />
          <button type="submit" disabled={pending !== null || !typed.trim()} className={SECONDARY}>
            <Icon name="search" size="sm" />
            {pending === "typed" ? "Checking…" : "Check"}
          </button>
        </div>
        <p className="text-sm text-muted">.com and .net addresses can be checked here. Short, easy to spell and easy to say out loud works best.</p>
      </form>

      {list.length ? (
        <ul className="flex flex-col gap-2" aria-label="Web address ideas">
          {list.map((domain) => {
            const check = checked.get(domain);
            return (
              <li
                key={domain}
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-surface px-3.5 py-2.5 shadow-soft ${chosen === domain ? "border-accent" : "border-line"}`}
              >
                <Icon name="globe" className="text-faint" />
                <span className="min-w-0 flex-1 basis-40 break-all font-semibold">{domain}</span>
                {check ? (
                  <Chip tone={STATUS[check.status].tone}>
                    {STATUS[check.status].label}
                    <span className="sr-only">
                      , checked <LocalDate iso={check.checkedAt} />
                    </span>
                  </Chip>
                ) : null}
                {!check || check.status === "unknown" ? (
                  <button type="button" disabled={pending !== null} onClick={() => run(domain, () => checkDomainAction(domain))} className={SECONDARY}>
                    {pending === domain ? "Checking…" : "Check"}
                  </button>
                ) : null}
                {check?.status === "available" && chosen !== domain ? (
                  <button type="button" disabled={pending !== null} onClick={() => run(`choose-${domain}`, () => chooseDomainAction(domain))} className={PRIMARY}>
                    Use this one
                  </button>
                ) : null}
                {chosen === domain ? (
                  <Chip tone="accent" icon="check">
                    Your choice
                  </Chip>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="text-sm text-muted">
        “Not registered yet” means no one owned it when we asked the official registry. That can change, so buy it soon.
        Each option in step 1 says what a web address costs with it.
      </p>
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
