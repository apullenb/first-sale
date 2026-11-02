import { Suspense } from "react";
import type { IconName } from "@/components/icons";
import { Icon } from "@/components/icons";
import { MoveOn } from "@/components/move-on";
import { ListRow } from "@/components/plan/paperwork";
import { Chip, PageHead } from "@/components/ui";
import { progressLabel, SECTION_MEASURES } from "@/lib/progress-labels";
import { sectionSteps } from "@/lib/section-steps";
import { getSection, SECTIONS, sectionMetadata } from "@/lib/sections";
import { getMySidebarStatus } from "@/lib/sidebar-status";

export const metadata = sectionMetadata("/build-your-brand");

const ICONS: Record<string, IconName> = {
  "/brand": "palette",
  "/logo": "badge",
  "/website": "globe",
  "/products": "tag",
  "/marketing": "megaphone",
  "/social": "users",
  "/brand-library": "image",
};

export default function BuildYourBrandPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHead
        kicker={
          <span className="inline-flex items-center gap-2">
            <Icon name="palette" size="sm" />
            Build your brand · Every step
          </span>
        }
        title="Build your brand"
        lead="Every step to give your business a look and a voice, in order. Each one says whether it’s done or still to do."
      />
      <Suspense fallback={<p className="text-muted">Loading your steps…</p>}>
        <Steps />
      </Suspense>
    </div>
  );
}

async function Steps() {
  const { business, status } = await getMySidebarStatus();
  const ready = Boolean(business?.profile);
  const parts = status?.parts ?? {};
  const steps = sectionSteps("Build your brand");
  const done = steps.filter((step) => parts[step.href]?.state === "done").length;
  const firstOpen = ready ? steps.find((step) => parts[step.href]?.state !== "done")?.href : undefined;
  const extras = SECTIONS.filter((section) => section.group === "Build your brand" && section.step === null && !section.overview && !section.under);
  return (
    <>
      {ready ? (
        <div className="-mt-2 flex flex-col gap-2">
          <Chip tone="done" icon="check">
            {progressLabel(SECTION_MEASURES["Build your brand"], done, steps.length)} done
          </Chip>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-wash">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((done / steps.length) * 100)}%` }} />
          </div>
        </div>
      ) : null}
      <MoveOn from="Build your brand" />
      <ol className="grid gap-2.5" aria-label="Steps in Build your brand">
        {steps.map((step, index) => (
          <ListRow
            key={step.href}
            href={ready ? step.href : "/business/new"}
            title={`${index + 1}. ${step.title}`}
            summary={getSection(step.href).summary}
            state={!ready ? "locked" : parts[step.href]?.state === "done" ? "done" : "ready"}
            icon={ICONS[step.href] ?? "file"}
            next={step.href === firstOpen}
            note={ready ? null : "Do this first: Your business"}
          />
        ))}
      </ol>
      {extras.length ? (
        <section aria-labelledby="also-heading" className="flex flex-col gap-2.5">
          <h2 id="also-heading" className="font-display text-[22px] leading-snug">
            Also here
          </h2>
          <ul className="grid gap-2.5">
            {extras.map((section) => (
              <ListRow key={section.href} href={section.href} title={section.title} summary={section.summary} state="ready" word="Open anytime" icon={ICONS[section.href] ?? "file"} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
