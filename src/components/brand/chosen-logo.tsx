import Link from "next/link";
import { chooseLogoAction } from "@/app/(app)/brand/actions";
import { removeChosenLogoAction } from "@/app/(app)/logo/actions";
import { ActionButton } from "@/components/action-button";
import { Icon } from "@/components/icons";
import { Done } from "@/components/marketing/pieces";
import { SECONDARY_LINK } from "@/components/styles";
import { Card } from "@/components/ui";
import { brandFileUrl } from "@/lib/brand/files";
import type { AssetSummary } from "@/lib/data/brand";
import { CheckNotes, MadeBy } from "./asset-view";
import { EditPrompt } from "./controls";
import { LogoUpload } from "./logo-upload";
import { Reveal } from "./reveal";

interface Props {
  chosen: AssetSummary;
  // Logos made from the chosen one by "Edit my logo", newest first
  edits: AssetSummary[];
  // The logo the chosen one was edited from, if any
  before: AssetSummary | null;
  // The chosen logo has versions or brand images in use
  hasPicks: boolean;
  practice: boolean;
  businessName: string;
  maxBytes: number;
}

function caption(chosen: AssetSummary): string {
  if (chosen.origin === "uploaded") return `You uploaded this logo${chosen.title ? ` (${chosen.title})` : ""}. It’s kept exactly as you sent it.`;
  if (chosen.change) return chosen.design?.preset ? `You chose this logo (${chosen.change}).` : `You chose this edited logo. You asked: “${chosen.change}”.`;
  return "You chose this logo.";
}

// The chosen logo, large, with what the owner can do next; questions and ideas stay hidden
export function ChosenLogo({ chosen, edits, before, hasPicks, practice, businessName, maxBytes }: Props) {
  const own = chosen.conceptId === null;
  const switchNote = hasPicks ? "Use this logo instead? The versions and brand images you picked were made from your current logo, so they’ll be cleared." : undefined;
  return (
    <Card title="Your logo" icon="check" tone="done" id="your-logo-heading" bodyClassName="gap-5">
      <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-start">
        <figure className="flex flex-col gap-2">
          <div className="grid min-h-56 place-items-center rounded-xl border border-line bg-white p-5 sm:min-h-72">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brandFileUrl(chosen.id)}
              alt={chosen.simulated ? "Practice preview of your logo" : "Your logo"}
              width={chosen.width}
              height={chosen.height}
              className="h-auto max-h-72 w-auto max-w-full object-contain"
            />
          </div>
          <figcaption>
            <Done>
              <span className="flex flex-wrap items-center gap-2">
                {caption(chosen)}
              </span>
            </Done>
          </figcaption>
        </figure>

        <div className="flex flex-col items-start gap-3">
          <EditPrompt
            target={{ kind: "logo", assetId: chosen.id }}
            label="Edit my logo"
            hint={practice ? "Practice mode: you’ll see a labeled sample." : ""}
            working="Making an edited copy of your logo and checking it… this can take a minute or two"
            done="Done. Your edited logo is below, next to this one. Choose “Use this” to switch to it."
          />
          {own ? <p className="text-sm text-muted">Your original file never changes: each edit is a new copy, and you choose which one to use.</p> : null}
          <Reveal label="Upload a new logo" icon="upload">
            <LogoUpload businessName={businessName} maxBytes={maxBytes} replacing />
          </Reveal>
          <Link href="/logo?ideas=new" className={SECONDARY_LINK}>
            <Icon name="sparkles" size="sm" />
            Make new logo ideas
          </Link>
          <ActionButton
            action={removeChosenLogoAction}
            label="Remove"
            pendingLabel="Removing…"
            variant="danger"
            confirm={
              chosen.origin === "uploaded"
                ? "Remove your uploaded logo, with the edits, versions and pictures made from it? This can’t be undone."
                : own
                  ? "Remove this edited logo, with the versions and pictures made from it? Your original upload stays. This can’t be undone."
                  : "Stop using this logo? It stays with your logo ideas, and the versions and pictures made from it leave your brand kit."
            }
          />
        </div>
      </div>

      {edits.length || before ? (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <h3 className="font-bold">{edits.length ? "Your edits" : "Before your edit"}</h3>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...edits, ...(before ? [before] : [])].map((logo) => (
              <li key={logo.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 shadow-soft">
                <div className="grid min-h-32 place-items-center rounded-lg border border-line bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={brandFileUrl(logo.id)} alt={logo.simulated ? "Practice preview of a logo" : "A logo"} width={logo.width} height={logo.height} loading="lazy" className="h-auto max-h-32 w-auto max-w-full object-contain" />
                </div>
                <p className="text-sm font-semibold break-words">
                  {logo.id === before?.id ? "Before your edit" : logo.design?.preset ? `Changed: ${logo.change}` : `You asked: “${logo.change ?? ""}”`}
                </p>
                {logo.origin === "uploaded" ? (
                  <p className="flex items-center gap-2 text-sm text-muted">
                    Uploaded by you
                  </p>
                ) : (
                  <>
                    <MadeBy simulated={logo.simulated} model={logo.model} what={own ? "Edited by AI from your logo" : undefined} />
                    <CheckNotes check={logo.check} simulated={logo.simulated} />
                  </>
                )}
                <ActionButton action={chooseLogoAction.bind(null, logo.id)} label={logo.id === before?.id ? "Go back to this one" : "Use this"} pendingLabel="Saving…" variant={logo.id === before?.id ? "secondary" : "primary"} confirm={switchNote} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
