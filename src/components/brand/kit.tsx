import { CARD, SECONDARY_LINK } from "@/components/styles";
import { brandFileName, kindTitle as title } from "@/lib/brand/files";
import { IMAGE_SPECS, LOGO_SPECS } from "@/lib/brand/sizes";
import type { AssetKind, BrandFile, BrandKit } from "@/lib/brand/types";
import { PracticeTag } from "./asset-view";
import { ExactDownload } from "./exact-download";

const download = (file: BrandFile) => file.url.split("?")[0];

export function KitSection({ kit }: { kit: BrandKit }) {
  const logos: [AssetKind, BrandFile | null][] = [
    ["logo", kit.logos.primary],
    ["stacked", kit.logos.stacked],
    ["profile", kit.logos.profile],
    ["solid", kit.logos.solid],
  ];
  const images: [AssetKind, BrandFile | null][] = [
    ["facebook_cover", kit.images.facebookCover],
    ["youtube_banner", kit.images.youtubeBanner],
    ["website_hero", kit.images.websiteHero],
    ["link_preview", kit.images.linkPreview],
  ];
  return (
    <section aria-labelledby="kit-heading" className={`${CARD} flex flex-col gap-5`}>
      <div className="flex flex-col gap-1">
        <h2 id="kit-heading" className="font-display text-2xl font-bold">
          7. Your brand kit
        </h2>
        <p className="text-rule">
          Everything you approved for {kit.businessName}, in one place. First Sale’s website section uses these too. Every file has a plain white background: Muse Image can’t make see-through ones.
        </p>
        {kit.simulated ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-check">
            <PracticeTag /> Some files are practice previews. Don’t use them as your logo.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">Colors</h3>
        <ul className="flex flex-wrap gap-3">
          {kit.colors.map((color) => (
            <li key={color.hex} className="flex items-center gap-3 rounded-xl bg-ground py-2 pr-4 pl-2">
              <span aria-hidden="true" className="size-10 rounded-lg ring-1 ring-ink/10" style={{ backgroundColor: color.hex }} />
              <span className="flex flex-col">
                <span className="font-semibold">{color.name}</span>
                <span className="font-mono text-sm text-muted">{color.hex.toUpperCase()}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">Logos</h3>
        <ul className="grid gap-3 sm:grid-cols-2">
          {logos.map(([kind, file]) => (
            <li key={kind} className="flex flex-col gap-2 rounded-xl bg-ground p-3">
              <span className="font-semibold">{title(kind)}</span>
              {file ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={file.url} alt={`${title(kind)} logo`} width={file.width} height={file.height} loading="lazy" className="h-auto w-full rounded-lg bg-white" />
                  <a href={download(file)} download className={SECONDARY_LINK}>
                    Download
                  </a>
                  {kind === "profile"
                    ? LOGO_SPECS.profile.exports.map((spec) => (
                        <ExactDownload key={spec.label} src={file.url} spec={spec} fileName={brandFileName(kit.businessName, kind, kit.simulated, `${spec.width}x${spec.height}`)} />
                      ))
                    : null}
                </>
              ) : (
                <p className="text-sm text-muted">Not approved yet.</p>
              )}
            </li>
          ))}
        </ul>
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
