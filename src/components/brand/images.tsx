import { pickImageAction, unpickImageAction } from "@/app/(app)/brand/actions";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { Icon } from "@/components/icons";
import { Done, SectionHead, SOFT } from "@/components/marketing/pieces";
import { SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card } from "@/components/ui";
import { dollars } from "@/lib/brand/cost";
import { brandFileName, brandFileUrl } from "@/lib/brand/files";
import { CHECKED, IMAGE_SPECS } from "@/lib/brand/sizes";
import { type BrandImageKind, type BrandPicks, IMAGE_KINDS } from "@/lib/brand/types";
import type { AssetSummary } from "@/lib/data/brand";
import { CheckNotes, MadeBy } from "./asset-view";
import { BrandRunButton } from "./controls";
import { ExactDownload } from "./exact-download";
import { GuidedImage } from "./guided-image";

interface Props {
  chosenId: string;
  name: string;
  assets: AssetSummary[];
  picks: BrandPicks;
  practice: boolean;
  running: boolean;
}

export function ImagesSection({ chosenId, name, assets, picks, practice, running }: Props) {
  const made = (kind: BrandImageKind) => assets.filter((asset) => asset.kind === kind && asset.sourceId === chosenId);
  const missing = IMAGE_KINDS.filter((kind) => made(kind).length === 0);
  const free = "Practice mode: nothing is charged.";

  return (
    <section aria-labelledby="images-heading" className="@container flex flex-col gap-4">
      <SectionHead id="images-heading" number={2} title="Make pictures for your pages">
        <p className="max-w-2xl text-muted">
          {practice
            ? "In practice mode each picture is a plain preview. With Muse connected, it makes each one from your logo, in its colors and style, shaped for where it goes."
            : "Muse makes each picture from your logo, in its colors and style, shaped for where it goes."}{" "}
          The boxes show what each site crops or covers. Downloads are resized to the exact size in your browser.
        </p>
      </SectionHead>
      {missing.length && !running ? (
        <Card>
          <BrandRunButton
            intent={{ kind: "images", kinds: missing }}
            label={missing.length === IMAGE_KINDS.length ? "Make my brand pictures" : "Make the missing pictures"}
            pendingLabel="Making pictures…"
            working="Making your brand pictures and checking them… this can take two or three minutes"
            cost={practice ? free : `${missing.length} ${missing.length === 1 ? "picture" : "pictures"}: ${dollars(missing.length)}.`}
          />
        </Card>
      ) : null}
      {running ? <p className="text-muted">Making your pictures…</p> : null}

      <ul className="grid gap-4 @3xl:grid-cols-2">
        {IMAGE_KINDS.filter((kind) => made(kind).length).map((kind) => {
          const versions = made(kind);
          const latest = versions.at(-1)!;
          const picked = versions.find((asset) => asset.id === picks[kind]) ?? null;
          return (
            <li key={kind}>
              <ImageCard kind={kind} name={name} latest={latest} picked={picked} practice={practice} running={running} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ImageCard({ kind, name, latest, picked, practice, running }: { kind: BrandImageKind; name: string; latest: AssetSummary; picked: AssetSummary | null; practice: boolean; running: boolean }) {
  const spec = IMAGE_SPECS[kind];
  const headingId = `image-${kind}`;
  return (
    <Card title={spec.title} icon="image" id={headingId} headingLevel={3} className="flex h-full flex-col" bodyClassName="flex-1">
      <p className="text-sm text-muted">{spec.purpose}</p>
      <GuidedImage
        src={brandFileUrl(latest.id)}
        alt={latest.simulated ? `Practice preview of your ${spec.title.toLowerCase()}` : `Your ${spec.title.toLowerCase()}`}
        width={latest.width}
        height={latest.height}
        guides={spec.guides}
      />
      <MadeBy simulated={latest.simulated} what={latest.change ? `Made by Meta’s Muse Image · you asked: “${latest.change}”` : "Made by Meta’s Muse Image from your logo"} />
      <CheckNotes check={latest.check} simulated={latest.simulated} checking={running} />

      <div className="flex flex-col gap-1 text-sm text-rule">
        <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-accent">
          {spec.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
        {spec.source ? (
          <p className="text-muted">
            Source:{" "}
            <a href={spec.source.url} target="_blank" rel="noreferrer" className={TEXT_LINK}>
              {spec.source.name}
            </a>
            , checked {CHECKED}. Sites change their sizes, so check before you upload.
          </p>
        ) : null}
        <p className="text-muted">{latest.simulated ? `Practice preview, ${latest.width} × ${latest.height} pixels.` : `Muse made it at ${latest.width} × ${latest.height} pixels.`}</p>
        {!latest.simulated && spec.exports.some((exportSpec) => exportSpec.width > latest.width) ? (
          <p className="text-muted">That’s smaller than the size the site asks for, so the download is enlarged and may look a little soft.</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        {spec.exports.map((exportSpec) => (
          <ExactDownload key={exportSpec.label} src={brandFileUrl(latest.id)} spec={exportSpec} fileName={brandFileName(name, kind, latest.simulated, `${exportSpec.width}x${exportSpec.height}`)} />
        ))}
        <a href={brandFileUrl(latest.id, false)} download className={SECONDARY_LINK}>
          <Icon name="download" size="sm" />
          {latest.simulated ? "Download the practice preview" : "Download as Muse made it"}
        </a>
      </div>

      {picked?.id === latest.id ? (
        <div className="flex flex-col gap-2">
          <Done>
            <span className="flex flex-wrap items-center gap-2">
              <ActorChip actor="owner" /> In your brand kit
            </span>
          </Done>
          <ActionButton action={unpickImageAction.bind(null, kind)} label="Take it out of my kit" pendingLabel="Removing…" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {picked ? <p className="text-sm text-muted">Your brand kit has an earlier one. Add this one to use it instead.</p> : null}
          <ActionButton action={pickImageAction.bind(null, latest.id)} label="Add to my brand kit" pendingLabel="Adding…" variant="primary" />
        </div>
      )}

      {!running ? (
        <details className={`group/new ${SOFT}`}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2 font-semibold [&::-webkit-details-marker]:hidden">
            <Icon name="refresh" size="sm" className="text-accent" />
            <span className="flex-1">Make a new one</span>
            <Icon name="chevron" size="sm" className="text-faint transition-transform group-open/new:rotate-90" />
          </summary>
          <div className="border-t border-line bg-surface px-4 py-4">
            <BrandRunButton
              intent={{ kind: "images", kinds: [kind] }}
              label="Make a new one"
              pendingLabel="Making it…"
              working="Making a new picture… this can take a minute or two"
              variant="secondary"
              withChange
              cost={practice ? "Practice mode: nothing is charged." : `One picture: ${dollars(1)}.`}
            />
          </div>
        </details>
      ) : null}
    </Card>
  );
}
