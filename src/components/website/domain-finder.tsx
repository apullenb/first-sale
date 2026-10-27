"use client";

import { useId, useLayoutEffect, useState } from "react";
import { checkDomainAction, chooseDomainAction } from "@/app/(app)/website/actions";
import { LocalDate } from "@/components/local-date";
import { ALERT, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import type { DomainCheck } from "@/lib/website/types";

interface Props {
  ideas: string[];
  checks: DomainCheck[];
  chosen: string | null;
}

const STATUS = {
  available: { label: "Not registered yet", style: "bg-accent-tint text-accent-ink" },
  taken: { label: "Already taken", style: "bg-rule-tint text-rule" },
  unknown: { label: "Couldn’t check", style: "bg-check-tint text-check" },
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
        <p className="rounded-xl bg-accent-tint px-4 py-3 text-accent-ink">
          Your web address: <strong className="break-all">{chosen}</strong>. Buy it when you set up your site; until then, someone else could.
        </p>
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
              <li key={domain} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-ground px-3.5 py-2.5">
                <span className="min-w-0 flex-1 basis-48 break-all font-semibold">{domain}</span>
                {check ? (
                  <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${STATUS[check.status].style}`}>
                    {STATUS[check.status].label}
                    <span className="sr-only">
                      , checked <LocalDate iso={check.checkedAt} />
                    </span>
                  </span>
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
                {chosen === domain ? <span className="text-sm font-semibold text-accent-ink">Your choice</span> : null}
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
