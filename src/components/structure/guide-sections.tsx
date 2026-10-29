import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { IconTile } from "@/components/ui";
import type { StructureExample } from "@/data/structure-examples";
import { STRUCTURE_LABELS } from "@/lib/details";
import type { BusinessStructure } from "@/lib/domain";
import { type Line, NAME_POINTS, otherTaxPoints } from "@/lib/structure/options";
import type { Reason } from "@/lib/structure/suggest";
import { ExplainWhy, ReasonList, RecommendedTag, ShowExamples } from "./explain";
import { SourceLink } from "./source-link";

// One part of the guide: a white card with a serif heading
export function GuideSection({ id, icon, title, lead, children }: { id: string; icon: IconName; title: string; lead: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-[14px] border border-line bg-surface p-4 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <IconTile icon={icon} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id={id} className="scroll-mt-6 font-display text-[22px] leading-snug">
            {title}
          </h3>
          <p className="text-[15px] text-muted">{lead}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function Points({ lines }: { lines: readonly Line[] }) {
  return (
    <ul className="flex flex-col gap-2 text-[15px]">
      {lines.map((line) => (
        <li key={line.text} className="flex items-start gap-2.5">
          <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent" />
          <span>
            {line.text}
            {line.fact ? <SourceLink fact={line.fact} /> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

// What the rules recommend for this owner, with the reasons folded underneath
export function ForYou({ label, reasons, children }: { label: ReactNode; reasons: Reason[] | null; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-accent-ring bg-accent-tint/50 px-4 pt-3 pb-1.5">
      <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-accent">For you</p>
      <p className="font-semibold leading-snug">{label}</p>
      {reasons ? (
        <div className="flex flex-col gap-0.5">
          <RecommendedTag />
          <ExplainWhy>
            <ReasonList reasons={reasons} />
            {children}
          </ExplainWhy>
        </div>
      ) : (
        <div className="pb-1.5">{children}</div>
      )}
    </div>
  );
}

function Folded({ title, summary, open, children }: { title: string; summary: string; open: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group/fold rounded-xl border border-line bg-soft">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="grid min-w-0 flex-1 gap-px">
          <b className="font-bold">{title}</b>
          <small className="text-[14.5px] text-muted">{summary}</small>
        </span>
        <Icon name="chevron" className="text-faint transition-transform group-open/fold:rotate-90 motion-reduce:transition-none" />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

export function NameInfo({
  folded,
  foldedWhy,
  forYou,
  examples,
}: {
  // Likely doesn't apply, so the details fold away
  folded: boolean;
  foldedWhy: string;
  forYou: ReactNode;
  examples: StructureExample[];
}) {
  return (
    <GuideSection id="guide-name" icon="tag" title="The name you sell under" lead="Registering a name is separate from your structure. A DBA doesn’t create a company.">
      {folded ? (
        <Folded title="How business names work" summary={foldedWhy} open={false}>
          <Points lines={NAME_POINTS} />
        </Folded>
      ) : (
        <Points lines={NAME_POINTS} />
      )}
      {forYou}
      <ShowExamples examples={examples} />
    </GuideSection>
  );
}

export function TaxInfo({
  owners,
  defaults,
  points,
  otherOpen,
  forYou,
  examples,
}: {
  owners: number;
  defaults: { option: BusinessStructure; text: string; fact: Line["fact"] }[];
  // Self-employment tax and notes that fit these owners
  points: Line[];
  otherOpen: boolean;
  forYou: ReactNode;
  examples: StructureExample[];
}) {
  return (
    <GuideSection id="guide-tax" icon="receipt" title="How you’re taxed" lead="Each structure has a default way the IRS taxes it. Some can choose another.">
      <ul className="flex flex-col gap-2 text-[15px]">
        {defaults.map((item) => (
          <li key={item.option} className="flex flex-col gap-0.5 rounded-lg border border-line px-3.5 py-2.5 sm:flex-row sm:gap-3">
            <span className="shrink-0 font-semibold sm:w-48">{STRUCTURE_LABELS[item.option]}</span>
            <span>
              {item.text}
              {item.fact ? <SourceLink fact={item.fact} /> : null}
            </span>
          </li>
        ))}
      </ul>
      <Points lines={points} />
      <Folded title="Other tax choices" summary={otherOpen ? "Worth asking about, given your answers" : "Less common at the start, such as S corporation status"} open={otherOpen}>
        <Points lines={otherTaxPoints(owners)} />
      </Folded>
      {forYou}
      <ShowExamples examples={examples} />
    </GuideSection>
  );
}
