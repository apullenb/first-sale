import Link from "next/link";
import { ActorChip } from "@/components/actor-chip";
import { Icon } from "@/components/icons";
import { PRIMARY_LINK } from "@/components/styles";
import { PROBLEM_LABELS } from "@/lib/photos/looks";
import type { PhotoCheck } from "@/lib/photos/types";

// What the check found before editing: problems that stop an accurate edit, and the details to keep
export function CheckSummary({ check }: { check: PhotoCheck }) {
  if (check.method === "skipped") {
    return (
      <p className="text-rule">
        This photo wasn’t looked at by AI: no AI service that can see photos is connected. Look at it yourself, then answer the
        questions below.
      </p>
    );
  }

  const keep = [
    ...check.keep.colors.map((item) => `Color: ${item}`),
    ...check.keep.materials.map((item) => `Material: ${item}`),
    ...check.keep.textAndLogos.map((item) => `Lettering or logo: ${item}`),
    ...(check.keep.quantity ? [`How many: ${check.keep.quantity}`] : []),
    ...check.keep.details,
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-start gap-2.5 text-rule">
        <ActorChip actor="ai" />
        <span className="min-w-0 flex-1">{check.summary || "AI looked at your photo."}</span>
      </p>

      {!check.usable ? (
        <div className="flex flex-col gap-3 rounded-xl border border-check-ring bg-check-tint px-4 py-3 text-check">
          <p className="font-semibold">This photo can’t be edited accurately, so nothing will be made from it.</p>
          <p className="text-[15px]">
            First Sale won’t guess at parts of your product it can’t see clearly. A quick retake usually fixes it, with no
            special equipment.
          </p>
          {check.problems.length ? (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px]">
              {check.problems.map((problem) => (
                <li key={`${problem.kind}:${problem.detail}`}>
                  <strong>{PROBLEM_LABELS[problem.kind]}:</strong> {problem.detail}
                </li>
              ))}
            </ul>
          ) : null}
          {check.retakeTips.length ? (
            <>
              <p className="font-semibold">For your next photo</p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px]">
                {check.retakeTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </>
          ) : null}
          <Link href="/photos#upload" className={PRIMARY_LINK}>
            Upload a new photo
          </Link>
        </div>
      ) : check.problems.length ? (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-rule">
          {check.problems.map((problem) => (
            <li key={`${problem.kind}:${problem.detail}`}>{problem.detail}</li>
          ))}
        </ul>
      ) : null}

      {check.usable && keep.length ? (
        <details className="group/keep rounded-xl border border-line bg-soft text-sm text-rule">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 font-semibold text-ink [&::-webkit-details-marker]:hidden">
            <span className="flex-1">Details the edit must keep</span>
            <Icon name="chevron" size="sm" className="text-faint transition-transform group-open/keep:rotate-90" />
          </summary>
          <ul className="flex list-disc flex-col gap-1 pr-3.5 pb-3 pl-8 marker:text-accent">
            {keep.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
