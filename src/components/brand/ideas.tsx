import { chooseLogoAction } from "@/app/(app)/brand/actions";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { LocalDate } from "@/components/local-date";
import { CARD, SECTION_TITLE } from "@/components/styles";
import { dollars, IDEAS } from "@/lib/brand/cost";
import { brandFileUrl } from "@/lib/brand/files";
import { CONCEPT_KINDS_TEXT } from "@/lib/brand/prompts";
import { applyDesign } from "@/lib/brand/refine";
import type { BrandBrief } from "@/lib/brand/types";
import type { ColorFamily } from "@/lib/brand/vibes";
import type { AssetSummary, ConceptRow, RoundSummary } from "@/lib/data/brand";
import { CheckNotes, MadeBy, PracticeTag } from "./asset-view";
import { BrandRunButton, RefineLogo } from "./controls";

interface Props {
  rounds: RoundSummary[];
  assets: AssetSummary[];
  chosenLogoId: string | null;
  practice: boolean;
  // Round ids with drawing still running
  drawing: Set<string>;
  // From the owner's saved brief, for one-click changes
  ownerTagline: string;
  pickedFamilies: ColorFamily[];
}

interface Shared {
  assets: AssetSummary[];
  chosenLogoId: string | null;
  practice: boolean;
  ownerTagline: string;
  pickedFamilies: ColorFamily[];
}

export function IdeasSection({ rounds, drawing, ...shared }: Props) {
  const { practice } = shared;
  const titles = new Map(rounds.flatMap((round) => round.concepts.map((concept) => [concept.id, concept.concept.title])));
  const [latest, ...older] = rounds;
  return (
    <section aria-labelledby="ideas-heading" className="flex scroll-mt-4 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="ideas-heading" className="font-display text-2xl font-bold">
          4. Pick your logo
        </h2>
        <p className="text-rule">
          {practice
            ? "In practice mode these ideas are placeholders and each logo is a plain labeled preview. Connect Muse to get ideas written and drawn for your business."
            : "Each idea was written for your business and drawn by Muse. Choose the one you like, change it with one click or in your own words, or ask for more like it."}
        </p>
      </div>
      {latest ? <Round key={latest.id} round={latest} {...shared} drawing={drawing.has(latest.id)} basedOn={titles.get(latest.basedOnConceptId ?? "")} /> : null}
      {older.length ? (
        <details className="rounded-2xl bg-surface ring-1 ring-ink/5">
          <summary className="flex min-h-12 cursor-pointer items-center px-5 font-semibold">Earlier ideas ({older.length} {older.length === 1 ? "round" : "rounds"})</summary>
          <div className="flex flex-col gap-4 p-3">
            {older.map((round) => (
              <Round key={round.id} round={round} {...shared} drawing={drawing.has(round.id)} basedOn={titles.get(round.basedOnConceptId ?? "")} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function Round({ round, drawing, basedOn, ...shared }: Shared & { round: RoundSummary; drawing: boolean; basedOn?: string }) {
  const { assets, practice } = shared;
  const undrawn = round.concepts.filter((concept) => !assets.some((asset) => asset.kind === "logo" && asset.conceptId === concept.id && asset.sourceId === null));
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <ActorChip actor="ai" />
        {basedOn ? `More like “${basedOn}”` : `${round.concepts.length} ideas`} · <LocalDate iso={round.createdAt.toISOString()} />
        {round.simulated ? <PracticeTag /> : null}
      </p>
      {undrawn.length && !drawing ? (
        <div className={`${CARD} flex flex-col gap-2`}>
          <p className="text-rule">{undrawn.length === 1 ? "One idea hasn’t been drawn yet." : `${undrawn.length} ideas haven’t been drawn yet.`}</p>
          <BrandRunButton
            intent={{ kind: "draw", roundId: round.id }}
            label="Draw the missing logos"
            pendingLabel="Drawing…"
            working="Drawing logos and checking their spelling… this can take two or three minutes"
            cost={practice ? "Practice mode: nothing is charged." : `${undrawn.length} ${undrawn.length === 1 ? "picture" : "pictures"}: ${dollars(undrawn.length)}.`}
          />
        </div>
      ) : null}
      <ul className="flex flex-col gap-4">
        {round.concepts.map((concept) => (
          <li key={concept.id}>
            <ConceptCard
              {...shared}
              concept={concept}
              brief={round.brief}
              drafts={assets.filter((asset) => asset.kind === "logo" && asset.conceptId === concept.id)}
              drawing={drawing}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConceptCard({ concept, brief, drafts, drawing, ...shared }: Shared & { concept: ConceptRow; brief: BrandBrief; drafts: AssetSummary[]; drawing: boolean }) {
  const { chosenLogoId, practice } = shared;
  const idea = concept.concept;
  const headingId = `concept-${concept.id}`;
  return (
    <article aria-labelledby={headingId} className={`${CARD} flex flex-col gap-4`}>
      <div className="flex flex-col gap-1.5">
        <p className="w-fit rounded-full bg-rule-tint px-2.5 py-0.5 text-xs font-bold text-rule">{CONCEPT_KINDS_TEXT[idea.kind].label}</p>
        <h3 id={headingId} className={SECTION_TITLE}>
          {idea.title}
        </h3>
        <p>{idea.idea}</p>
        <p className="text-sm text-muted">
          <span className="font-semibold text-rule">Lettering:</span> {idea.typography}
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Colors">
          {idea.palette.map((color) => (
            <li key={color.hex} className="flex items-center gap-2 rounded-full bg-ground py-1 pr-3 pl-1 text-sm">
              <span aria-hidden="true" className="size-6 rounded-full ring-1 ring-ink/10" style={{ backgroundColor: color.hex }} />
              {color.name} <span className="text-muted">{color.hex.toUpperCase()}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-rule">
          <span className="font-semibold">Why it fits:</span> {idea.rationale}
        </p>
      </div>

      {drafts.length === 0 ? (
        <p className="rounded-xl bg-ground px-4 py-6 text-center text-muted">{drawing ? "Drawing this idea…" : "Not drawn yet."}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {drafts.map((draft, index) => (
            <li key={draft.id} className="flex flex-col gap-3">
              <Draft {...shared} draft={draft} drawn={applyDesign(idea, brief, draft.design)} number={index + 1} chosen={draft.id === chosenLogoId} hasChoice={chosenLogoId !== null} />
            </li>
          ))}
        </ul>
      )}

      {drafts.length ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <BrandRunButton
            intent={{ kind: "more", conceptId: concept.id }}
            label="More ideas like this"
            pendingLabel="Writing ideas…"
            working="Writing new ideas like this one… this can take a minute"
            variant="secondary"
            cost={practice ? "Practice mode: nothing is charged." : `${IDEAS.more} new ideas, each drawn: ${dollars(IDEAS.more)}, plus a little for writing them.`}
          />
        </div>
      ) : null}
    </article>
  );
}

function Draft({
  draft,
  drawn,
  number,
  chosen,
  hasChoice,
  practice,
  ownerTagline,
  pickedFamilies,
}: Shared & { draft: AssetSummary; drawn: ReturnType<typeof applyDesign>; number: number; chosen: boolean; hasChoice: boolean }) {
  const src = brandFileUrl(draft.id);
  return (
    <>
      <figure className="flex flex-col gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={draft.simulated ? "Practice preview: a plain placeholder with your business name, not a logo" : `Logo draft ${number}`}
          width={draft.width}
          height={draft.height}
          loading="lazy"
          className={`h-auto w-full rounded-xl bg-white ring-1 ${chosen ? "ring-2 ring-accent" : "ring-ink/10"}`}
        />
        <figcaption className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{draft.change ? (draft.design?.preset ? `Changed: ${draft.change}` : `Changed: “${draft.change}”`) : `Draft ${number}`}</span>
            <MadeBy simulated={draft.simulated} />
          </span>
        </figcaption>
      </figure>
      <div className="flex flex-wrap items-end gap-3 text-sm text-muted">
        <span>How it looks small:</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-12 w-auto rounded bg-white ring-1 ring-ink/10" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-6 w-auto rounded bg-white ring-1 ring-ink/10" />
      </div>
      <CheckNotes check={draft.check} simulated={draft.simulated} />
      {chosen ? (
        <p className="flex w-fit items-center gap-2 rounded-xl bg-accent-tint px-3 py-2 font-semibold text-accent-ink">
          <ActorChip actor="owner" /> Your chosen logo
        </p>
      ) : (
        <ActionButton
          action={chooseLogoAction.bind(null, draft.id)}
          label="Choose this logo"
          pendingLabel="Choosing…"
          variant="primary"
          confirm={hasChoice ? "Choose this logo instead? Your logo versions and brand images were made from your current logo, so they’ll be cleared from your brand kit." : undefined}
        />
      )}
      <details className="rounded-xl bg-ground">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold">Change this logo</summary>
        <div className="px-4 pb-4">
          <RefineLogo
            assetId={draft.id}
            cost={practice ? "Practice mode: nothing is charged." : `One picture: ${dollars(1)}.`}
            current={{ palette: drawn.concept.palette, typography: drawn.concept.typography, tagline: drawn.brief.tagline.trim() }}
            ownerTagline={ownerTagline}
            pickedFamilies={pickedFamilies}
          />
        </div>
      </details>
    </>
  );
}
