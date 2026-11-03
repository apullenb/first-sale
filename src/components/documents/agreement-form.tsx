"use client";

import { type FormEvent, useId, useLayoutEffect, useState } from "react";
import { prepareAgreementAction } from "@/app/(app)/documents/agreement-actions";
import { Icon } from "@/components/icons";
import { ALERT, INPUT, PRIMARY } from "@/components/styles";
import { type ChoicesInput, DECISION_LABELS, DECISION_RULES, MAX_CONTRIBUTION, MAX_MANAGER } from "@/lib/documents/owners-agreement";
import { failedMessage } from "@/lib/failure";

interface Props {
  owners: string[];
  // "member" for an LLC, "partner" for a partnership
  who: "member" | "partner";
  hasManager: boolean;
  // Saved answers, by owner
  initial: Pick<ChoicesInput, "members" | "decisions" | "manager"> | null;
  // draftStamp of the draft this page shows
  basedOn: string;
  hasDraft: boolean;
  approved: boolean;
}

// Equal shares that add up to exactly 100
function evenShares(count: number): string[] {
  const each = Math.floor(10_000 / count);
  return Array.from({ length: count }, (_, index) => String((each + (index === 0 ? 10_000 - each * count : 0)) / 100));
}

export function AgreementForm({ owners, who, hasManager, initial, basedOn, hasDraft, approved }: Props) {
  const uid = useId();
  const single = owners.length === 1;
  const [values, setValues] = useState<Pick<ChoicesInput, "members" | "decisions" | "manager">>(() => {
    const shares = evenShares(owners.length);
    return {
      members: owners.map((_, index) => ({ percent: initial?.members[index]?.percent || shares[index], contribution: initial?.members[index]?.contribution ?? "" })),
      decisions: initial?.decisions ?? null,
      manager: initial?.manager ?? "",
    };
  });
  const [status, setStatus] = useState<"idle" | "working" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  const total = values.members.reduce((sum, member) => sum + Math.round((Number(member.percent.trim().replace(/\s*%$/, "")) || 0) * 100), 0) / 100;
  const setMember = (index: number, field: "percent" | "contribution", value: string) =>
    setValues((current) => ({ ...current, members: current.members.map((member, at) => (at === index ? { ...member, [field]: value } : member)) }));

  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (approved && !window.confirm("Preparing it again replaces the approved agreement. If it’s already signed, keep the signed copy: any change needs a new agreement signed again. Continue?")) return;
    setStatus("working");
    setError(null);
    try {
      const result = await prepareAgreementAction({ ...values, owners, basedOn });
      if (!result.ok) {
        setError(result.message);
        setStatus("idle");
      } else setStatus("done");
    } catch {
      setError(failedMessage());
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={prepare} className="flex flex-col gap-5">
      {owners.map((name, index) => (
        <fieldset key={name} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-soft">
          <legend className="float-left mb-1 flex w-full items-center gap-2.5 border-b border-line pb-3 font-bold">
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-wash text-muted">
              <Icon name="users" size="sm" />
            </span>
            {name}
          </legend>
          {single ? (
            <p className="text-[15px] text-rule">Owns 100%, as the only {who}.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-${index}-percent`} className="text-[15.5px] font-semibold">
                What {name} owns, as a percent
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`${uid}-${index}-percent`}
                  inputMode="decimal"
                  maxLength={6}
                  required
                  value={values.members[index].percent}
                  onChange={(event) => setMember(index, "percent", event.target.value)}
                  className={`${INPUT} max-w-28`}
                />
                <span aria-hidden="true">%</span>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-${index}-contribution`} className="text-[15.5px] font-semibold">
              What {name} is putting in <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id={`${uid}-${index}-contribution`}
              maxLength={MAX_CONTRIBUTION}
              value={values.members[index].contribution}
              onChange={(event) => setMember(index, "contribution", event.target.value)}
              className={INPUT}
              aria-describedby={`${uid}-contribution-hint`}
            />
          </div>
        </fieldset>
      ))}
      <p id={`${uid}-contribution-hint`} className="-mt-2 text-[14.5px] text-muted">
        Money, equipment or other property, with its value if you know it. For example: “$2,000 cash” or “a stand mixer worth $400”.
      </p>
      {single ? null : (
        <p role="status" className={total === 100 ? "text-[14.5px] text-muted" : ALERT}>
          {total === 100 ? "The shares add up to 100%." : `The shares add up to ${total}%. They need to add up to 100%.`}
        </p>
      )}

      {single ? null : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[15.5px] font-semibold">How do the {who}s make decisions?</legend>
          {DECISION_RULES.map((rule) => (
            <label
              key={rule}
              className="flex min-h-[50px] cursor-pointer items-center gap-3 rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 font-semibold leading-snug shadow-soft transition hover:border-muted has-checked:border-accent has-checked:ring-[3px] has-checked:ring-accent-tint has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name={`${uid}-decisions`}
                value={rule}
                required
                checked={values.decisions === rule}
                onChange={() => setValues((current) => ({ ...current, decisions: rule }))}
                className="size-[18px] shrink-0 accent-accent"
              />
              {DECISION_LABELS[rule]}
            </label>
          ))}
          <p className="text-[14.5px] text-muted">Either way, adding an owner, selling the business, changing the agreement or ending the business needs everyone.</p>
        </fieldset>
      )}

      {hasManager ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-manager`} className="text-[15.5px] font-semibold">
            Full name of the LLC’s manager
          </label>
          <input
            id={`${uid}-manager`}
            maxLength={MAX_MANAGER}
            required
            value={values.manager}
            onChange={(event) => setValues((current) => ({ ...current, manager: event.target.value }))}
            className={INPUT}
            aria-describedby={`${uid}-manager-hint`}
          />
          <p id={`${uid}-manager-hint`} className="text-[14.5px] text-muted">
            Your details say a chosen manager runs the LLC. The manager can be one of the owners.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col items-start gap-2 border-t border-line pt-4">
        <button type="submit" disabled={status === "working"} className={PRIMARY}>
          <Icon name="scale" size="sm" />
          {status === "working" ? "Preparing…" : hasDraft ? "Prepare it again" : "Prepare my agreement"}
        </button>
        <p role="status" className={status === "done" ? "text-[14.5px] text-muted" : "sr-only"}>
          {status === "done" ? "Your agreement is ready. Read it below." : ""}
        </p>
        {error ? (
          <p role="alert" className={ALERT}>
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
