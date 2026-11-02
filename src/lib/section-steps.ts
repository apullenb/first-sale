import { sectionState, type SidebarStatus, type StartStep, startSteps } from "@/lib/rules/section-status";
import { SECTIONS, type SectionGroup } from "@/lib/sections";

// Sections that are steps to finish, in order
export const JOURNEY: SectionGroup[] = ["Start your business", "Build your brand"];

// Start your business comes from the owner's paperwork; the other sections' steps are fixed
export function sectionSteps(group: SectionGroup, start?: StartStep[]): StartStep[] {
  return group === "Start your business"
    ? (start ?? startSteps([]))
    : SECTIONS.filter((section) => section.group === group && section.step !== null).map((section) => ({ href: section.href, title: section.title, later: false }));
}

// Steps that hold a section open: everything but what comes after the first sale
export const countedSteps = (group: SectionGroup, start?: StartStep[]) => sectionSteps(group, start).filter((step) => !step.later).map((step) => step.href);

// Where each finished section hands off to
export const NEXT_SECTION: Record<"Start your business" | "Build your brand", { label: string; group: SectionGroup | null; href: string }> = {
  "Start your business": { label: "Move on to branding", group: "Build your brand", href: "/brand" },
  "Build your brand": { label: "Move on to running your business", group: null, href: "/run" },
};

// Done once nothing in it is left for the owner, as the menu marks it
export function sectionFinished(parts: SidebarStatus, group: SectionGroup, start?: StartStep[]): boolean {
  return sectionState(parts, countedSteps(group, start)) !== "todo";
}

// The next section's first step still to do, or its first step
export function nextSectionHref(parts: SidebarStatus, from: keyof typeof NEXT_SECTION): string {
  const next = NEXT_SECTION[from];
  if (!next.group) return next.href;
  const steps = sectionSteps(next.group);
  return (steps.find((step) => parts[step.href]?.state !== "done") ?? steps[0])?.href ?? next.href;
}
