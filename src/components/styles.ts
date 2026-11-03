// Shared class lists for the Onramp look: ruled white cards, serif headings, one teal-blue accent

export const PRIMARY =
  "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[10px] border border-accent bg-accent px-[18px] font-bold text-white shadow-button transition hover:bg-accent-ink active:translate-y-px disabled:border-line disabled:bg-wash disabled:text-faint disabled:shadow-none";
export const SECONDARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-surface px-4 font-semibold text-ink shadow-soft transition hover:border-muted hover:bg-soft active:translate-y-px disabled:opacity-60";
export const AI_BUTTON =
  "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[10px] bg-ai px-[18px] font-bold text-white shadow-soft transition hover:opacity-90 active:translate-y-px disabled:opacity-60";
export const DANGER =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-danger/40 bg-surface px-4 font-semibold text-danger transition hover:border-danger disabled:opacity-60";
export const PRIMARY_LINK =
  "inline-flex min-h-[46px] w-fit items-center justify-center gap-2 rounded-[10px] border border-accent bg-accent px-[18px] font-bold text-white shadow-button transition hover:bg-accent-ink active:translate-y-px";
export const SECONDARY_LINK =
  "inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-surface px-4 font-semibold text-ink shadow-soft transition hover:border-muted hover:bg-soft";
export const TEXT_LINK = "font-semibold text-accent underline decoration-[1.5px] underline-offset-[3px] hover:text-accent-ink";
export const CARD = "rounded-[14px] border border-line bg-surface p-5 shadow-card";
export const INPUT =
  "min-h-12 w-full rounded-[10px] border border-field bg-surface px-3 py-2.5 text-base shadow-soft focus:border-accent focus:ring-2 focus:ring-accent-ring";
export const EYEBROW = "text-[13.5px] font-bold uppercase tracking-[0.08em] text-accent";
export const PAGE_TITLE = "font-display text-[32px] leading-[1.15] tracking-[-0.01em] sm:text-[38px]";
export const SECTION_TITLE = "font-display text-[22px] leading-snug";
export const ALERT = "rounded-xl border border-check-ring bg-check-tint px-3.5 py-3 text-[15px] text-check";
export const LEAD = "max-w-2xl text-lg text-muted";

// The three kinds of things a page points to: something to do here, something to do on another site, and optional reading
// Ruled margin, like a planner page; the kicker carries the to-do icon (ActionKicker)
export const ACTION_ITEM =
  "relative flex flex-col gap-3.5 rounded-2xl border border-line bg-surface py-5 pr-5 pl-[34px] shadow-lift before:absolute before:inset-y-0 before:left-[18px] before:w-[1.5px] before:bg-accent-ring sm:py-6 sm:pr-6 sm:pl-[46px] sm:before:left-7";
export const OUTSIDE_LINK =
  "inline-flex min-h-12 w-fit max-w-full items-center gap-3 rounded-[10px] border-[1.5px] border-accent bg-accent-tint px-4 py-2 text-left text-accent-ink shadow-soft transition hover:bg-surface active:translate-y-px motion-reduce:transition-none";
export const RESOURCE_LINK =
  "inline-flex min-h-8 items-center gap-1 text-sm text-muted underline decoration-line-strong underline-offset-[3px] hover:text-accent hover:decoration-accent";
