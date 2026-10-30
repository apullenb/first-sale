import Link from "next/link";
import { saveLogoGuideAction } from "@/app/(app)/brand/actions";
import { ActionButton } from "@/components/action-button";
import { Icon } from "@/components/icons";
import { SectionHead } from "@/components/marketing/pieces";
import { TEXT_LINK } from "@/components/styles";
import { Card, Note } from "@/components/ui";
import { colorRows } from "@/lib/brand/colors";
import { BRAND_IMAGES_HREF } from "@/lib/brand/library";
import type { BrandKit } from "@/lib/brand/types";
import { PracticeTag } from "./asset-view";
import { LogoFiles } from "./logo-files";

export function KitSection({ kit, guideId, number }: { kit: BrandKit; guideId: string | null; number: number }) {
  return (
    <section aria-labelledby="kit-heading" className="@container flex flex-col gap-4">
      <SectionHead id="kit-heading" number={number} title="Your brand kit" lead={`Your logo and the versions you chose for ${kit.businessName}, with the files you’ll need. Your website and Brand Library use these too.`}>
        {kit.simulated ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-check">
            <PracticeTag /> Some files are practice previews. Don’t use them as your logo.
          </p>
        ) : null}
      </SectionHead>

      <Card title="Colors" icon="palette" id="kit-colors" headingLevel={3}>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          Readability on white is worked out from each color’s contrast (the WCAG standard), not by AI.
        </p>
        {kit.colors.length === 0 ? <p className="text-[15px] text-muted">No colors saved yet. Pick your logo’s colors above, and they’ll show here.</p> : null}
        <ul className="grid gap-2.5 @2xl:grid-cols-2">
          {colorRows(kit.colors).map((color) => (
            <li key={color.hex} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-2.5 shadow-soft">
              <span aria-hidden="true" className="size-12 shrink-0 rounded-lg ring-1 ring-ink/10" style={{ backgroundColor: color.hex }} />
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{color.name}</span>
                <span className="font-mono text-sm text-muted">
                  {color.hex} · {color.rgb}
                </span>
                <span className="text-sm text-rule">{color.use}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Logo files" icon="download" id="kit-files" headingLevel={3}>
        <LogoFiles
          businessName={kit.businessName}
          simulated={kit.simulated}
          practice={kit.uploaded ? { primary: false } : undefined}
          colors={kit.colors}
          sources={{ primary: kit.logos.primary?.url ?? null, stacked: kit.logos.stacked?.url ?? null, profile: kit.logos.profile?.url ?? null, solid: kit.logos.solid?.url ?? null }}
        />
      </Card>

      <Card title="Logo guide" icon="file" id="kit-guide" headingLevel={3}>
        <p className="text-[15px] text-rule">
          One printable page for you, a printer or a helper: your logo, colors with their codes, lettering, the space to leave around it, and do’s and don’ts.
          It’s saved to your Documents{kit.simulated ? " and marked as practice" : ""}.
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <ActionButton action={saveLogoGuideAction} label={guideId ? "Update my logo guide" : "Save my logo guide"} pendingLabel="Making your guide…" variant="primary" openDocument />
          {guideId ? (
            <Link href={`/documents/${guideId}`} className={`${TEXT_LINK} inline-flex min-h-11 items-center gap-1.5`}>
              Open the saved guide
              <Icon name="arrow" size="sm" />
            </Link>
          ) : null}
        </div>
      </Card>

      <Note icon="image" tone="quiet">
        <p className="text-rule">
          Your brand images, like your website header and Facebook cover, are made and kept in{" "}
          <Link href={BRAND_IMAGES_HREF} className={TEXT_LINK}>
            your Brand Library
          </Link>
          .
        </p>
      </Note>
    </section>
  );
}
