import { chooseLogoAction } from "@/app/(app)/brand/actions";
import { ActionButton } from "@/components/action-button";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { Done, SectionHead, SOFT } from "@/components/marketing/pieces";
import { Card, Chip, Note } from "@/components/ui";
import { dollars, IDEAS } from "@/lib/brand/cost";
import { brandFileUrl } from "@/lib/brand/files";
import { CONCEPT_KINDS_TEXT } from "@/lib/brand/prompts";
import { applyDesign } from "@/lib/brand/refine";
import type { BrandBrief } from "@/lib/brand/types";
import type { ColorFamily } from "@/lib/brand/vibes";
import type { AssetSummary, ConceptRow, RoundSummary } from "@/lib/data/brand";
import { CheckNotes, MadeBy, PracticeTag } from "./asset-view";
import { BrandRunButton, EditPrompt, RefineLogo } from "./controls";

interface Props {
  number: number;
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

export function IdeasSection({ number, rounds, drawing, ...shared }: Props) {
  const { practice } = shared;
  const titles = new Map(rounds.flatMap((round) => round.concepts.map((concept) => [concept.id, concept.concept.title])));
  const [latest, ...older] = rounds;
  return (
    <section aria-labelledby="ideas-heading" className="flex scroll-mt-4 flex-col gap-4">
      <SectionHead
        id="ideas-heading"
        number={number}
        title="Pick your logo"
        lead={
          practice
            ? "In practice mode these ideas are placeholders and each logo is a plain labeled preview. Connect Muse to get ideas written and drawn for your business."
            : "Each idea was written from your brand description and choices, and drawn by Muse. Choose the one you like, edit it in your own words, or ask for more like it."
        }
      />
      {latest ? <Round key={latest.id} round={latest} {...shared} drawing={drawing.has(latest.id)} basedOn={titles.get(latest.basedOnConceptId ?? "")} /> : null}
      {older.length ? (
        <details className="group/older rounded-[14px] border border-line bg-surface shadow-soft">
          <summary className="flex min-h-[58px] cursor-pointer list-none items-center gap-3 px-[18px] py-3 [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-line bg-wash text-muted">
              <Icon name="clock" />
            </span>
            <b className="flex-1 font-bold">
              Earlier ideas ({older.length} {older.length === 1 ? "round" : "rounds"})
            </b>
            <Icon name="chevron" className="text-faint transition-transform group-open/older:rotate-90" />
          </summary>
          <div className="flex flex-col gap-6 border-t border-line bg-soft p-4">
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
    <div className="@container flex flex-col gap-3">
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        {basedOn ? `More like “${basedOn}”` : `${round.concepts.length} ideas`} · <LocalDate iso={round.createdAt.toISOString()} />
        {round.simulated ? <PracticeTag /> : null}
      </p>
      {undrawn.length && !drawing ? (
        <Note icon="pencil" tone="quiet">
          <p className="mb-2 text-rule">{undrawn.length === 1 ? "One idea hasn’t been drawn yet." : `${undrawn.length} ideas haven’t been drawn yet.`}</p>
          <BrandRunButton
            intent={{ kind: "draw", roundId: round.id }}
            label="Draw the missing logos"
            pendingLabel="Drawing…"
            working="Drawing logos and checking their spelling… this can take two or three minutes"
            cost={practice ? "Practice mode: nothing is charged." : `${undrawn.length} ${undrawn.length === 1 ? "picture" : "pictures"}: ${dollars(undrawn.length)}.`}
          />
        </Note>
      ) : null}
      <ul className="grid items-start gap-5 @3xl:grid-cols-2">
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
    <Card title={idea.title} id={headingId} headingLevel={3} action={<Chip tone="gray">{CONCEPT_KINDS_TEXT[idea.kind].label}</Chip>} bodyClassName="gap-4">
      {drafts.length === 0 ? (
        <p className="grid aspect-[3/2] place-items-center rounded-xl border border-line bg-soft text-muted">{drawing ? "Drawing this idea…" : "Not drawn yet."}</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {drafts.map((draft, index) => (
            <li key={draft.id} className={`flex flex-col gap-3 ${index ? "border-t border-line pt-5" : ""}`}>
              <Draft {...shared} draft={draft} drawn={applyDesign(idea, brief, draft.design)} number={index + 1} chosen={draft.id === chosenLogoId} hasChoice={chosenLogoId !== null} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <p>{idea.idea}</p>
        <ul className="flex flex-wrap gap-2" aria-label="Colors">
          {idea.palette.map((color) => (
            <li key={color.hex} className="flex items-center gap-2 rounded-lg border border-line bg-surface py-1 pr-2.5 pl-1 text-sm">
              <span aria-hidden="true" className="size-6 rounded-md ring-1 ring-ink/10" style={{ backgroundColor: color.hex }} />
              {color.name} <span className="text-muted">{color.hex.toUpperCase()}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          <span className="font-semibold text-rule">Lettering:</span> {idea.typography}
        </p>
        <p className="text-sm text-muted">
          <span className="font-semibold text-rule">Why it fits:</span> {idea.rationale}
        </p>
      </div>

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
    </Card>
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
          className={`h-auto w-full rounded-xl border bg-white ${chosen ? "border-accent shadow-[0_0_0_3px_var(--color-accent-tint)]" : "border-line"}`}
        />
        <figcaption className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold break-words">{draft.change ? (draft.design?.preset ? `Changed: ${draft.change}` : `You asked: “${draft.change}”`) : `Draft ${number}`}</span>
          <MadeBy simulated={draft.simulated} model={draft.model} />
        </figcaption>
      </figure>
      <div className="flex flex-wrap items-end gap-3 text-sm text-muted">
        <span>How it looks small:</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-12 w-auto rounded border border-line bg-white" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-6 w-auto rounded border border-line bg-white" />
      </div>
      <CheckNotes check={draft.check} simulated={draft.simulated} />
      <div className="flex flex-wrap items-start gap-2">
        {chosen ? (
          <Done>
            <span className="flex flex-wrap items-center gap-2">
              Your chosen logo
            </span>
          </Done>
        ) : (
          <ActionButton
            action={chooseLogoAction.bind(null, draft.id)}
            label="Choose this logo"
            pendingLabel="Choosing…"
            variant="primary"
            doneHref="/logo"
            confirm={hasChoice ? "Choose this logo instead? Your logo versions and brand images were made from your current logo, so they’ll be cleared from your brand kit." : undefined}
          />
        )}
        <EditPrompt
          target={{ kind: "logo", assetId: draft.id }}
          cost={practice ? "Practice mode: nothing is charged." : `One picture: ${dollars(1)}.`}
          working="Changing your logo and checking the spelling… this can take a minute or two"
          done="Done. The changed logo is shown under this one, and this one is kept."
        />
      </div>
      <details className={`group/change ${SOFT}`}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2 font-semibold [&::-webkit-details-marker]:hidden">
          <Icon name="sparkles" size="sm" className="text-accent" />
          <span className="flex-1">Quick changes: simpler, colors, lettering, tagline</span>
          <Icon name="chevron" size="sm" className="text-faint transition-transform group-open/change:rotate-90" />
        </summary>
        <div className="border-t border-line bg-surface px-4 py-4">
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
