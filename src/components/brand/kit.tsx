import Link from "next/link";
import { saveLogoGuideAction } from "@/app/(app)/brand/actions";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { CARD, TEXT_LINK } from "@/components/styles";
import { brandFileName, kindTitle as title } from "@/lib/brand/files";
import { colorRows } from "@/lib/brand/colors";
import { IMAGE_SPECS } from "@/lib/brand/sizes";
import type { AssetKind, BrandFile, BrandKit } from "@/lib/brand/types";
import { PracticeTag } from "./asset-view";
import { ExactDownload } from "./exact-download";
import { LogoFiles } from "./logo-files";

export function KitSection({ kit, guideId }: { kit: BrandKit; guideId: string | null }) {
  const images: [AssetKind, BrandFile | null][] = [
    ["facebook_cover", kit.images.facebookCover],
    ["youtube_banner", kit.images.youtubeBanner],
    ["website_hero", kit.images.websiteHero],
    ["link_preview", kit.images.linkPreview],
  ];
  return (
    <section aria-labelledby="kit-heading" className={`${CARD} flex flex-col gap-6`}>
      <div className="flex flex-col gap-1">
        <h2 id="kit-heading" className="font-display text-2xl font-bold">
          7. Your brand kit
        </h2>
        <p className="text-rule">Everything you approved for {kit.businessName}, in one place, with the files you’ll need. First Sale’s website section uses these too.</p>
        {kit.simulated ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-check">
            <PracticeTag /> Some files are practice previews. Don’t use them as your logo.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">Colors</h3>
        <p className="text-sm text-muted">
          <ActorChip actor="rule" /> Readability on white is worked out from each color’s contrast (the WCAG standard), not by AI.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {colorRows(kit.colors).map((color) => (
            <li key={color.hex} className="flex items-start gap-3 rounded-xl bg-ground py-2 pr-4 pl-2">
              <span aria-hidden="true" className="size-10 shrink-0 rounded-lg ring-1 ring-ink/10" style={{ backgroundColor: color.hex }} />
              <span className="flex flex-col">
                <span className="font-semibold">{color.name}</span>
                <span className="font-mono text-sm text-muted">
                  {color.hex} · {color.rgb}
                </span>
                <span className="text-sm text-rule">{color.use}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <LogoFiles
        businessName={kit.businessName}
        simulated={kit.simulated}
        colors={kit.colors}
        sources={{ primary: kit.logos.primary?.url ?? null, stacked: kit.logos.stacked?.url ?? null, profile: kit.logos.profile?.url ?? null, solid: kit.logos.solid?.url ?? null }}
      />

      <div className="flex flex-col gap-2 rounded-xl bg-ground p-4">
        <h3 className="font-semibold">Logo guide</h3>
        <p className="text-sm text-rule">
          One printable page for you, a printer or a helper: your logo, colors with their codes, lettering, the space to leave around it, and do’s and
          don’ts. It’s saved to your Documents{kit.simulated ? " and marked as practice" : ""}.
        </p>
        <ActionButton action={saveLogoGuideAction} label={guideId ? "Update my logo guide" : "Save my logo guide"} pendingLabel="Making your guide…" variant="primary" openDocument />
        {guideId ? (
          <Link href={`/documents/${guideId}`} className={`${TEXT_LINK} w-fit text-sm`}>
            Open the saved guide
          </Link>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">Pictures</h3>
        <ul className="grid gap-3 sm:grid-cols-2">
          {images.map(([kind, file]) => (
            <li key={kind} className="flex flex-col gap-2 rounded-xl bg-ground p-3">
              <span className="font-semibold">{title(kind)}</span>
              {file ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={file.url} alt={title(kind)} width={file.width} height={file.height} loading="lazy" className="h-auto w-full rounded-lg bg-white" />
                  {IMAGE_SPECS[kind as keyof typeof IMAGE_SPECS].exports.map((spec) => (
                    <ExactDownload key={spec.label} src={file.url} spec={spec} fileName={brandFileName(kit.businessName, kind, kit.simulated, `${spec.width}x${spec.height}`)} />
                  ))}
                </>
              ) : (
                <p className="text-sm text-muted">Not added yet.</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
