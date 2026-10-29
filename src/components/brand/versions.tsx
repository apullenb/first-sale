import { ActorChip } from "@/components/actor-chip";
import { CARD, SECONDARY_LINK } from "@/components/styles";
import { dollars } from "@/lib/brand/cost";
import { brandFileName, brandFileUrl } from "@/lib/brand/files";
import { LOGO_SPECS, PROFILE_FACTS } from "@/lib/brand/sizes";
import { type BrandPicks, VERSION_KINDS, type VersionKind } from "@/lib/brand/types";
import type { AssetSummary } from "@/lib/data/brand";
import { CheckNotes, MadeBy } from "./asset-view";
import { ApproveVersions, BrandRunButton } from "./controls";
import { ExactDownload } from "./exact-download";
import { GuidedImage } from "./guided-image";

interface Props {
  chosen: AssetSummary;
  name: string;
  assets: AssetSummary[];
  picks: BrandPicks;
  practice: boolean;
  running: boolean;
}

// The newest version of each kind made from the chosen logo
export function latestVersions(assets: AssetSummary[], chosenId: string): Partial<Record<VersionKind, AssetSummary>> {
  const latest: Partial<Record<VersionKind, AssetSummary>> = {};
  for (const asset of assets) {
    if (asset.sourceId === chosenId && (VERSION_KINDS as readonly string[]).includes(asset.kind)) latest[asset.kind as VersionKind] = asset;
  }
  return latest;
}

export function VersionsSection({ chosen, name, assets, picks, practice, running }: Props) {
  const latest = latestVersions(assets, chosen.id);
  const missing = VERSION_KINDS.filter((kind) => !latest[kind]);
  const complete = missing.length === 0;
  const ids = complete ? { stacked: latest.stacked!.id, profile: latest.profile!.id, solid: latest.solid!.id } : null;
  const approved = ids !== null && VERSION_KINDS.every((kind) => picks[kind] === ids[kind]);
  const free = "Practice mode: nothing is charged.";

  return (
    <section aria-labelledby="versions-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="versions-heading" className="font-display text-2xl font-bold">
          5. Get your logo versions
        </h2>
        <p className="text-rule">
          {practice
            ? "In practice mode each version is a plain labeled preview. With Muse connected, it redraws your chosen logo three ways, starting from the logo itself, and AI compares each one with your logo."
            : "Muse redraws your chosen logo three ways, starting from the logo itself so the design stays the same. AI then compares each one with your logo."}
        </p>
      </div>

      <div className={`${CARD} flex flex-col gap-3`}>
        <h3 className="font-semibold">Your chosen logo</h3>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brandFileUrl(chosen.id)} alt={chosen.simulated ? "Practice preview of your logo" : "Your chosen logo"} width={chosen.width} height={chosen.height} className="h-auto w-full max-w-md rounded-xl bg-white ring-1 ring-ink/10" />
        {missing.length && !running ? (
          <BrandRunButton
            intent={{ kind: "versions", kinds: missing }}
            label={missing.length === 3 ? "Make the three versions" : "Make the missing versions"}
            pendingLabel="Making versions…"
            working="Making your logo versions and comparing them with your logo… this can take two or three minutes"
            cost={practice ? free : `${missing.length} ${missing.length === 1 ? "picture" : "pictures"}: ${dollars(missing.length)}.`}
          />
        ) : null}
        {running ? <p className="text-sm text-muted">Making your versions…</p> : null}
      </div>

      {Object.keys(latest).length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {VERSION_KINDS.filter((kind) => latest[kind]).map((kind) => {
            const version = latest[kind]!;
            const spec = LOGO_SPECS[kind];
            return (
              <li key={kind} className={`${CARD} flex flex-col gap-3`}>
                <div className="flex flex-col gap-0.5">
                  <h3 className="font-semibold">{spec.title}</h3>
                  <p className="text-sm text-muted">{spec.purpose}</p>
                </div>
                <GuidedImage
                  src={brandFileUrl(version.id)}
                  alt={version.simulated ? `Practice preview of the ${spec.title.toLowerCase()} version` : `${spec.title} version of your logo`}
                  width={version.width}
                  height={version.height}
                  guides={[]}
                  circle={kind === "profile"}
                />
                <MadeBy simulated={version.simulated} what="Made by Meta’s Muse Image from your logo" />
                <CheckNotes check={version.check} simulated={version.simulated} checking={running} />
                {kind === "profile" ? <p className="text-sm text-muted">{PROFILE_FACTS.facts.join(" ")}</p> : null}
                <div className="flex flex-col gap-2">
                  <a href={brandFileUrl(version.id, false)} download className={SECONDARY_LINK}>
                    Download full size
                  </a>
                  {spec.exports.map((exportSpec) => (
                    <ExactDownload key={exportSpec.label} src={brandFileUrl(version.id)} spec={exportSpec} fileName={brandFileName(name, kind, version.simulated, `${exportSpec.width}x${exportSpec.height}`)} />
                  ))}
                </div>
                {!running ? (
                  <BrandRunButton
                    intent={{ kind: "versions", kinds: [kind] }}
                    label="Try this one again"
                    pendingLabel="Making it again…"
                    working="Making this version again… this can take a minute or two"
                    variant="secondary"
                    cost={practice ? free : `One picture: ${dollars(1)}.`}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {ids && !running ? (
        approved ? (
          <p className="flex w-fit flex-wrap items-center gap-2 rounded-xl bg-accent-tint px-4 py-3 font-semibold text-accent-ink">
            <ActorChip actor="owner" /> You approved these versions. They’re in your brand kit.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {VERSION_KINDS.some((kind) => picks[kind]) ? <p className="text-sm text-muted">Your brand kit still has the versions you approved before. Approve these to use them instead.</p> : null}
            <ApproveVersions ids={ids} />
          </div>
        )
      ) : null}
    </section>
  );
}
