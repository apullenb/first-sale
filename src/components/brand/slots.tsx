import Link from "next/link";
import type { ReactNode } from "react";
import { pickFileAction, unpickFileAction } from "@/app/(app)/brand/actions";
import { ActionButton } from "@/components/action-button";
import { Icon, type IconName } from "@/components/icons";
import { Done } from "@/components/marketing/pieces";
import { SECONDARY_LINK } from "@/components/styles";
import { Card, Chip, ResourceLink } from "@/components/ui";
import { RecommendedBadge } from "@/components/recommended";
import { dollars } from "@/lib/brand/cost";
import { brandFileName, brandFileUrl } from "@/lib/brand/files";
import { CHECKED_TEXT, type Export, type Guide, IMAGE_SPECS, LOGO_SPECS, PROFILE_FACTS } from "@/lib/brand/sizes";
import { approvedExample, EXAMPLE_IMAGE, imageSlots, type Slot, versionSlots } from "@/lib/brand/slots";
import { type AssetCheck, type BrandImageKind, type BrandPicks, CODE_MODEL, type ImageMedium, type VersionKind } from "@/lib/brand/types";
import type { AssetSummary } from "@/lib/data/brand";
import { CheckNotes, MadeBy } from "./asset-view";
import { BrandRunButton, EditPrompt, type Intent, PlusTile } from "./controls";
import { ExactDownload } from "./exact-download";
import { GuidedImage } from "./guided-image";
import { MediumSwitch } from "./medium-switch";

type PictureKind = VersionKind | BrandImageKind;

const ICONS: Record<PictureKind, IconName> = {
  stacked: "layers",
  profile: "users",
  solid: "palette",
  website_hero: "monitor",
  facebook_cover: "image",
  youtube_banner: "image",
  link_preview: "link",
};

const ratio = (size: string) => size.replace("x", " / ");

// AI flagged something, so using it asks first
function flagged(check: AssetCheck | null): boolean {
  return check?.method === "ai" && Boolean(check.lettering?.problems.length || check.drift.length);
}

// Gray outlines of what goes in each slot, not real pictures
function SlotSketch({ kind }: { kind: PictureKind }) {
  const bar = (x: number, y: number, w: number, h = 6) => <rect key={`bar-${x}-${y}`} x={x} y={y} width={w} height={h} rx={h / 2} fill="currentColor" />;
  const dot = (cx: number, cy: number, r: number, opacity = 1) => <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" opacity={opacity} />;
  const shapes: Record<PictureKind, { box: string; body: ReactNode }> = {
    stacked: { box: "0 0 100 100", body: [dot(50, 36, 16), bar(22, 62, 56, 9), bar(32, 76, 36)] },
    profile: { box: "0 0 100 100", body: [<circle key="ring" cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="3" />, dot(50, 50, 18)] },
    solid: { box: "0 0 150 100", body: [dot(38, 50, 17), bar(64, 40, 62, 10), bar(64, 56, 44)] },
    website_hero: { box: "0 0 160 90", body: [bar(48, 36, 64, 9), bar(60, 52, 40), dot(14, 76, 20, 0.35), dot(150, 12, 22, 0.35)] },
    facebook_cover: { box: "0 0 160 90", body: [<rect key="band" x="0" y="22" width="160" height="46" fill="currentColor" opacity="0.25" />, dot(22, 70, 16, 0.6)] },
    youtube_banner: { box: "0 0 160 90", body: [<rect key="safe" x="46" y="34" width="68" height="22" rx="4" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />, bar(58, 42, 44)] },
    link_preview: { box: "0 0 190 100", body: [dot(72, 50, 13), bar(92, 44, 40, 10)] },
  };
  const { box, body } = shapes[kind];
  return (
    <svg viewBox={box} className="h-full w-full" aria-hidden="true">
      {body}
    </svg>
  );
}

interface SlotProps {
  kind: PictureKind;
  title: string;
  purpose: string;
  size: string;
  slot: Slot<PictureKind, AssetSummary>;
  intent: Extract<Intent, { kind: "versions" | "images" }>;
  name: string;
  practice: boolean;
  running: boolean;
  // Why "+" can't run yet, such as no logo chosen
  blocked?: string | null;
  guides?: Guide[];
  circle?: boolean;
  exports: Export[];
  facts?: ReactNode;
  // An empty slot is marked as recommended
  recommend?: boolean;
  // A line under the purpose, such as how the example works
  note?: string | null;
  // Shown under the note, such as the example's Photo / Illustration switch
  control?: ReactNode;
}

function SlotCard({ kind, title, purpose, size, slot, intent, name, practice, running, blocked, guides = [], circle, exports, facts, recommend, note, control }: SlotProps) {
  const { newest, picked, earlier } = slot;
  const one = practice ? "Practice mode: nothing is charged." : `One picture: ${dollars(1)}.`;
  const lower = title.toLowerCase();
  const status = picked ? (
    <Chip tone="done" icon="check">
      In use
    </Chip>
  ) : newest ? (
    <Chip tone="gray">Not used yet</Chip>
  ) : recommend ? (
    <RecommendedBadge>Recommended</RecommendedBadge>
  ) : null;
  return (
    <Card title={title} icon={ICONS[kind]} id={`slot-${kind}`} headingLevel={3} action={status} className="flex h-full flex-col" bodyClassName="flex-1">
      <p className="text-sm text-muted">{purpose}</p>
      {note ? <p className="text-sm text-rule">{note}</p> : null}
      {control}
      {!newest ? (
        running ? (
          <div className="grid place-items-center rounded-xl border border-line bg-wash text-muted" style={{ aspectRatio: ratio(size) }}>
            <p role="status" className="flex items-center gap-2 text-sm">
              <span aria-hidden="true" className="size-5 rounded-full border-2 border-accent-tint border-t-accent motion-safe:animate-spin" />
              Making it…
            </p>
          </div>
        ) : (
          <PlusTile
            intent={intent}
            label={`Make the ${lower}`}
            sketch={<SlotSketch kind={kind} />}
            ratio={ratio(size)}
            working={`Making your ${lower} and checking it… this can take a minute or two`}
            cost={one}
            blocked={blocked}
          />
        )
      ) : (
        <>
          <GuidedImage
            src={brandFileUrl(newest.id)}
            alt={newest.simulated ? `Practice preview of your ${lower}` : `Your ${lower}`}
            width={newest.width}
            height={newest.height}
            guides={guides}
            circle={circle}
          />
          <MadeBy simulated={newest.simulated} model={newest.model} what={newest.change ? `Made by Meta’s Muse Image · you asked: “${newest.change}”` : "Made by Meta’s Muse Image from your logo"} />
          {newest.change && newest.simulated ? <p className="text-sm text-muted">You asked: “{newest.change}”</p> : null}
          <CheckNotes check={newest.check} simulated={newest.simulated} checking={running} />

          {picked?.id === newest.id ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Done>
                <span className="flex flex-wrap items-center gap-2">
                  You’re using this one
                </span>
              </Done>
              <ActionButton action={unpickFileAction.bind(null, kind)} label="Stop using it" pendingLabel="Removing…" />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {picked ? <p className="text-sm text-muted">You’re using an earlier one, shown below. Choose “Use this” to use this one instead.</p> : null}
              <ActionButton
                action={pickFileAction.bind(null, newest.id)}
                label="Use this"
                pendingLabel="Saving…"
                variant="primary"
                confirm={flagged(newest.check) ? "AI flagged something to check on this one. Use it anyway?" : undefined}
              />
            </div>
          )}

          {!running ? (
            <div className="flex flex-wrap items-start gap-2 border-t border-line pt-3">
              {/* A new version is always drawn by the image model; the code-built one is already here */}
              <BrandRunButton
                intent={intent.kind === "versions" ? { ...intent, redraw: true } : intent}
                label={newest.model === CODE_MODEL ? "Have AI draw one instead" : "Regenerate"}
                pendingLabel="Making a new one…"
                working={`Making a new ${lower}… this can take a minute or two`}
                variant="secondary"
                cost={one}
              />
              <EditPrompt
                latestId={newest.id}
                target={{ kind: "picture", assetId: newest.id }}
                cost={one}
                working={`Changing your ${lower}… this can take a minute or two`}
                done="Done. The changed one is shown above, and the earlier one is kept below."
              />
            </div>
          ) : (
            <p className="text-sm text-muted">Making a new one…</p>
          )}

          {earlier.length ? <Earlier kind={kind} files={earlier} pickedId={picked?.id ?? null} /> : null}

          <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
            {exports.map((spec) => (
              <ExactDownload key={spec.label} src={brandFileUrl(newest.id)} spec={spec} fileName={brandFileName(name, kind, newest.simulated, `${spec.width}x${spec.height}`)} />
            ))}
            <a href={brandFileUrl(newest.id, false)} download className={SECONDARY_LINK}>
              <Icon name="download" size="sm" />
              {newest.simulated ? "Download the practice preview" : "Download full size"}
            </a>
            {facts}
          </div>
        </>
      )}
    </Card>
  );
}

// Older files of this slot, so the owner can compare and go back to one
function Earlier({ kind, files, pickedId }: { kind: PictureKind; files: AssetSummary[]; pickedId: string | null }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <p className="text-sm font-semibold">Earlier ones</p>
      <ul className="grid grid-cols-2 gap-3">
        {files.map((file) => (
          <li key={file.id} className="flex flex-col gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brandFileUrl(file.id)}
              alt={file.simulated ? "Practice preview, an earlier one" : "An earlier one"}
              width={file.width}
              height={file.height}
              loading="lazy"
              className={`h-auto w-full rounded-lg border bg-white ${kind === "profile" ? "aspect-square object-cover" : ""} ${file.id === pickedId ? "border-accent shadow-[0_0_0_3px_var(--color-accent-tint)]" : "border-line"}`}
            />
            <span className="text-sm break-words text-muted">{file.change ? `You asked: “${file.change}”` : "Made from your logo"}</span>
            {file.id === pickedId ? (
              <Chip tone="done" icon="check">
                In use
              </Chip>
            ) : (
              <ActionButton action={pickFileAction.bind(null, file.id)} label="Use this" pendingLabel="Saving…" confirm={flagged(file.check) ? "AI flagged something to check on this one. Use it anyway?" : undefined} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const SLOT_GRID = "grid gap-4 @2xl:grid-cols-2 @3xl:grid-cols-3";

// Stacked, icon and one-color: each made on its own from the chosen logo, and used only once picked
export function VersionSlots({ chosenId, name, assets, picks, practice, running }: { chosenId: string; name: string; assets: AssetSummary[]; picks: BrandPicks; practice: boolean; running: ReadonlySet<string> }) {
  return (
    <ul className={SLOT_GRID}>
      {versionSlots(assets, chosenId, picks).map((slot) => {
        const spec = LOGO_SPECS[slot.kind];
        return (
          <li key={slot.kind}>
            <SlotCard
              kind={slot.kind}
              title={spec.title}
              purpose={spec.purpose}
              size={spec.size}
              slot={slot}
              intent={{ kind: "versions", logoId: chosenId, kinds: [slot.kind] }}
              name={name}
              practice={practice}
              running={running.has(slot.kind)}
              circle={slot.kind === "profile"}
              exports={spec.exports}
              facts={slot.kind === "profile" ? <p className="text-sm text-muted">{PROFILE_FACTS.facts.join(" ")}</p> : null}
            />
          </li>
        );
      })}
    </ul>
  );
}

// The four brand images: the header first, as the example; the others wait until the owner uses it, then match it
export function ImageSlots({
  chosenId,
  name,
  assets,
  picks,
  practice,
  running,
  recommended,
  style,
}: {
  chosenId: string | null;
  name: string;
  assets: AssetSummary[];
  picks: BrandPicks;
  practice: boolean;
  running: ReadonlySet<string>;
  // Kinds worth making, from the owner's marketing answers
  recommended: readonly BrandImageKind[];
  // Photo or illustration, and whether the owner's switch or the rule decided
  style: { medium: ImageMedium; by: "owner" | "rules" };
}) {
  const example = approvedExample(assets, chosenId, picks);
  const exampleTitle = IMAGE_SPECS[EXAMPLE_IMAGE].title.toLowerCase();
  return (
    <ul className="grid gap-4 @2xl:grid-cols-2">
      {imageSlots(assets, chosenId, picks).map((slot) => {
        const spec = IMAGE_SPECS[slot.kind];
        const isExample = slot.kind === EXAMPLE_IMAGE;
        const blocked = !chosenId
          ? "Choose or upload your logo first: brand images are made from it."
          : !isExample && !example
            ? `First make your ${exampleTitle} and choose “Use this” on it. This one is then made to match its look, so you only pay for pictures in a style you like.`
            : null;
        const note = isExample
          ? example
            ? null
            : "Made first, as an example of the look. Change it with a prompt until you like it, then choose “Use this”: your other brand images are made to match it."
          : example
            ? `Made to match your ${exampleTitle}.`
            : null;
        return (
          <li key={slot.kind}>
            <SlotCard
              kind={slot.kind}
              title={spec.title}
              purpose={spec.purpose}
              size={spec.size}
              slot={slot}
              intent={{ kind: "images", logoId: chosenId ?? "", kinds: [slot.kind] }}
              name={name}
              practice={practice}
              running={running.has(slot.kind)}
              blocked={blocked}
              recommend={recommended.includes(slot.kind)}
              note={note}
              control={
                isExample && chosenId ? (
                  <MediumSwitch logoId={chosenId} medium={style.medium} by={style.by} hasExample={!slot.empty} cost={practice ? "practice mode, nothing is charged" : `one picture, ${dollars(1)}`} />
                ) : null
              }
              guides={spec.guides}
              exports={spec.exports}
              facts={<SizeFacts kind={slot.kind} />}
            />
          </li>
        );
      })}
    </ul>
  );
}

function SizeFacts({ kind }: { kind: BrandImageKind }) {
  const spec = IMAGE_SPECS[kind];
  return (
    <details className="group/facts text-sm text-rule">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold text-accent [&::-webkit-details-marker]:hidden">
        Sizes and cropping
        <Icon name="chevron" size="sm" className="text-faint transition-transform group-open/facts:rotate-90" />
      </summary>
      <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-accent">
        {spec.facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      {spec.source ? (
        <p className="mt-1 text-muted">
          Source:{" "}
          <ResourceLink href={spec.source.url}>{spec.source.name}</ResourceLink>
          , checked {CHECKED_TEXT}. Sites change their sizes, so check before you upload.
        </p>
      ) : null}
    </details>
  );
}

// Shown in place of the image slots before a logo is chosen
export function NoLogoYet() {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-line-strong bg-soft px-4 py-4">
      <p className="text-[15px] text-rule">Brand images are made from your logo, in its colors and style. Choose or upload your logo first.</p>
      <Link href="/logo" className={SECONDARY_LINK}>
        Go to step 2: Create your logo
        <Icon name="arrow" size="sm" />
      </Link>
    </div>
  );
}
