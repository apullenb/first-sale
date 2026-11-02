import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { PRIMARY_LINK } from "@/components/styles";
import { ActionItem } from "@/components/ui";
import { NEXT_SECTION, nextSectionHref, sectionFinished } from "@/lib/section-steps";
import { getMySidebarStatus } from "@/lib/sidebar-status";

type From = keyof typeof NEXT_SECTION;

const WORDS: Record<From, { title: string; lead: string }> = {
  "Start your business": {
    title: "You’ve finished Start your business",
    lead: "Nothing is left for you to do there. Next, give your business a look and a voice: your brand, logo, website and more.",
  },
  "Build your brand": {
    title: "You’ve finished Build your brand",
    lead: "Next, set up help with the daily work of running your business, like customer messages and orders.",
  },
};

// Shown once a section has nothing left for the owner, pointing to the next one
export function MoveOn({ from }: { from: From }) {
  return (
    <Suspense fallback={null}>
      <MoveOnWhenFinished from={from} />
    </Suspense>
  );
}

async function MoveOnWhenFinished({ from: section }: { from: From }) {
  const { business, status } = await getMySidebarStatus();
  if (!business?.profile || !status || !sectionFinished(status.parts, section, status.start)) return null;
  // Brand done early: skip ahead to running the business
  const from: From = section === "Start your business" && sectionFinished(status.parts, "Build your brand") ? "Build your brand" : section;
  const id = `move-on-${from.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <ActionItem
      id={id}
      kicker="Up next"
      icon={from === "Start your business" ? "palette" : "building"}
      title={WORDS[from].title}
      action={
        <Link href={nextSectionHref(status.parts, from)} className={PRIMARY_LINK}>
          {NEXT_SECTION[from].label}
          <Icon name="arrow" size="sm" />
        </Link>
      }
    >
      <p className="text-rule">{WORDS[from].lead}</p>
    </ActionItem>
  );
}
