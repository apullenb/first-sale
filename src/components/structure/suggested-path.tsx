import Link from "next/link";
import { Icon } from "@/components/icons";
import { TEXT_LINK } from "@/components/styles";
import { RecommendedPanel } from "@/components/recommended";
import type { PathSuggestion, Reason } from "@/lib/structure/suggest";
import { ReasonList } from "./explain";
import { SourceLink } from "./source-link";

// The rules' starting point for ownership, kept apart from any legal determination
export function SuggestedPath({ suggestion }: { suggestion: PathSuggestion }) {
  return (
    <RecommendedPanel eyebrow="Recommended for you" big>
      <p className="font-display text-xl leading-snug">{suggestion.headline}</p>
      <p className="text-sm text-muted">Worked out from your answers by fixed rules, not a legal decision. You choose, and you can change it later.</p>
    </RecommendedPanel>
  );
}

// Reasons for the suggested structure, then what would change it
export function StructureWhy({ reasons, suggestion }: { reasons: Reason[]; suggestion: PathSuggestion }) {
  return (
    <>
      <ReasonList reasons={reasons} />
      {suggestion.wouldChange.length ? (
        <div className="flex flex-col gap-1.5 border-t border-line pt-3">
          <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">This could change if</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] marker:text-faint">
            {suggestion.wouldChange.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link href="/business/edit" className={`relative z-10 inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] ${TEXT_LINK}`}>
        <Icon name="pencil" size="sm" />
        Correct an answer
      </Link>
    </>
  );
}

// Questions to take to a professional, for the "Not sure yet?" fold
export function AskAProfessional({ questions }: { questions: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      {questions.length ? (
        <>
          <h3 className="font-bold">Questions to take to a professional</h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] marker:text-faint">
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="text-[15px] text-muted">
        The SBA offers counseling through its resource partners
        <SourceLink fact="sba_counseling" />. It also says business counselors, attorneys and accountants can help
        <SourceLink fact="counselors" />.
      </p>
    </div>
  );
}
