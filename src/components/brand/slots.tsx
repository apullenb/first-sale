import Link from "next/link";
import type { ReactNode } from "react";
import { pickFileAction, unpickFileAction } from "@/app/(app)/brand/actions";
import { ActionButton } from "@/components/action-button";
import { Icon, type IconName } from "@/components/icons";
import { Done } from "@/components/marketing/pieces";
import { SECONDARY_LINK } from "@/components/styles";
import { Card, Chip, ResourceLink } from "@/components/ui";
import { RecommendedBadge } from "@/components/recommended";
import { brandFileName, brandFileUrl } from "@/lib/brand/files";
import { CHECKED_TEXT, type Export, type Guide, IMAGE_SPECS, LOGO_SPECS, PROFILE_FACTS } from "@/lib/brand/sizes";
import { approvedExample, EXAMPLE_IMAGE, IMAGE_GROUPS, imageSlots, type Slot, versionSlots } from "@/lib/brand/slots";
import { type AssetCheck, type BrandImageKind, type BrandPicks, CODE_MODEL, type ImageMedium, type VersionKind } from "@/lib/brand/types";
import type { AssetSummary } from "@/lib/data/brand";
import { MadeBy } from "./asset-view";
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
  instagram_post: "camera",
  instagram_story: "phone",
  ad_square: "megaphone",
  flyer: "print",
  product_scene: "box",
};

const ratio = (size: string) => size.replace("x", " / ");

// AI flagged something, so using it asks first
export function flagged(check: AssetCheck | null): boolean {
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
    instagram_post: { box: "0 0 80 100", body: [dot(40, 44, 14), bar(22, 66, 36), dot(14, 88, 14, 0.35)] },
    instagram_story: { box: "0 0 90 160", body: [bar(10, 10, 70, 6), dot(45, 76, 16), bar(10, 144, 70, 6)] },
    ad_square: { box: "0 0 100 100", body: [dot(50, 44, 16), bar(28, 70, 44), dot(88, 12, 18, 0.35)] },
    flyer: {
      box: "0 0 85 110",
      body: [<rect key="top" x="0" y="0" width="85" height="27" fill="currentColor" opacity="0.15" />, dot(42, 55, 14), <rect key="bottom" x="0" y="83" width="85" height="27" fill="currentColor" opacity="0.15" />],
    },
    product_scene: { box: "0 0 120 90", body: [<rect key="shelf" x="10" y="64" width="100" height="5" fill="currentColor" />, bar(24, 38, 14, 26), bar(48, 30, 18, 34), bar(76, 42, 16, 22)] },
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
  // Brand images: where it's used and the exact size it's made at
  usedOn?: string;
  exact?: { width: number; height: number };
}

function SlotCard({ kind, title, purpose, size, slot, intent, name, practice, running, blocked, guides = [], circle, exports, facts, recommend, note, control, usedOn, exact }: SlotProps) {
  const { newest, picked, earlier } = slot;
  const one = practice ? "Practice mode: you’ll see a labeled sample." : "";
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
      {usedOn && exact ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">Used on</dt>
          <dd className="font-semibold">{usedOn}</dd>
          <dt className="text-muted">Exact size</dt>
          <dd className="font-semibold">
            {exact.width} × {exact.height} pixels
          </dd>
        </dl>
      ) : null}
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
            hint={one}
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
          <MadeBy simulated={newest.simulated} model={newest.model} what={newest.change ? `Made by AI · you asked: “${newest.change}”` : "Made by AI from your logo"} />
          {newest.change && newest.simulated ? <p className="text-sm text-muted">You asked: “{newest.change}”</p> : null}

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
                label={newest.model === CODE_MODEL ? "Have AI draw one instead" : intent.kind === "images" ? "Make another" : "Regenerate"}
                pendingLabel="Making a new one…"
                working={`Making a new ${lower}… this can take a minute or two`}
                variant="secondary"
                hint={one}
              />
              <EditPrompt
                latestId={newest.id}
                target={{ kind: "picture", assetId: newest.id }}
                hint={one}
                working={`Changing your ${lower}… this can take a minute or two`}
                done="Done. The changed one is shown above, and the earlier one is kept below."
              />
            </div>
          ) : (
            <p className="text-sm text-muted">Making a new one…</p>
          )}

          {earlier.length ? <Earlier kind={kind} files={earlier} pickedId={picked?.id ?? null} /> : null}

          <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
            {/* A file already saved at an export's size is the plain download below */}
            {exports.filter((spec) => spec.width !== newest.width || spec.height !== newest.height).map((spec) => (
              <ExactDownload key={spec.label} src={brandFileUrl(newest.id)} spec={spec} fileName={brandFileName(name, kind, newest.simulated, `${spec.width}x${spec.height}`)} />
            ))}
            <a href={brandFileUrl(newest.id, false)} download className={SECONDARY_LINK}>
              <Icon name="download" size="sm" />
              {newest.simulated ? "Download the practice preview" : exact ? `Download (${exact.width} × ${exact.height})` : "Download full size"}
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

export interface ImageSlotsProps {
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
}

// Each kind's full card, also shown as an image's detail view in the library
export function imageSlotCards({ chosenId, name, assets, picks, practice, running, recommended, style }: ImageSlotsProps): Record<BrandImageKind, ReactNode> {
  const example = approvedExample(assets, chosenId, picks);
  const exampleTitle = IMAGE_SPECS[EXAMPLE_IMAGE].title.toLowerCase();
  const all = imageSlots(assets, chosenId, picks);
  const card = (slot: (typeof all)[number]) => {
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
        ? `Made in the style of your ${exampleTitle}, with a scene of its own.`
        : null;
    return (
      <SlotCard
        kind={slot.kind}
        title={spec.title}
        purpose={spec.purpose}
        size={`${spec.final.width}x${spec.final.height}`}
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
            <MediumSwitch logoId={chosenId} medium={style.medium} by={style.by} hasExample={!slot.empty} hint={practice ? "Practice mode: you’ll see a labeled sample." : ""} />
          ) : null
        }
        guides={spec.guides}
        exports={spec.exports}
        usedOn={spec.usedOn}
        exact={spec.final}
        facts={<SizeFacts kind={slot.kind} />}
      />
    );
  };
  return Object.fromEntries(all.map((slot) => [slot.kind, card(slot)])) as Record<BrandImageKind, ReactNode>;
}

// Brand images in two groups: the header first, as the example; the others wait until the owner uses it, then match it
export function ImageSlots(props: ImageSlotsProps) {
  const { chosenId, assets, picks, running, recommended } = props;
  const exampleTitle = IMAGE_SPECS[EXAMPLE_IMAGE].title.toLowerCase();
  const all = imageSlots(assets, chosenId, picks);
  const cards = imageSlotCards(props);
  const card = (slot: (typeof all)[number]) => <li key={slot.kind}>{cards[slot.kind]}</li>;
  const [pages, extras] = IMAGE_GROUPS.map((group) => all.filter((slot) => (group.kinds as readonly string[]).includes(slot.kind)));
  // Opened once something there is made, being made or recommended
  const openExtras = extras.some((slot) => !slot.empty || running.has(slot.kind) || recommended.includes(slot.kind));
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-xl border border-line bg-soft px-3 py-2.5 text-[15px] text-rule">
        <Icon name="info" size="sm" className="mt-0.5 shrink-0 text-accent" />
        <span>A picture SnapStart makes isn’t used on your website or anywhere else until you approve it with “Use this”.</span>
      </p>
      <section aria-labelledby="images-pages-heading" className="flex flex-col gap-3">
        <h3 id="images-pages-heading" className="font-bold">
          {IMAGE_GROUPS[0].title}
        </h3>
        <ul className="grid gap-4 @2xl:grid-cols-2">{pages.map(card)}</ul>
      </section>
      <details id="images-extras" open={openExtras} className="group/extras border-t border-line pt-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <Icon name="chevron" size="sm" className="text-faint transition-transform group-open/extras:rotate-90" />
          <span className="font-bold">{IMAGE_GROUPS[1].title}</span>
          <Chip tone="gray">Optional</Chip>
        </summary>
        <p className="mt-1 mb-3 text-[15px] text-muted">Make any of these when you need them. Each is made in the style of your {exampleTitle}, with a scene of its own, at its exact size, with no words besides your logo.</p>
        <ul className="grid gap-4 @2xl:grid-cols-2">{extras.map(card)}</ul>
      </details>
    </div>
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
        <li>SnapStart makes this picture at exactly {spec.final.width} × {spec.final.height} pixels, with your logo inside the part every screen shows.</li>
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
