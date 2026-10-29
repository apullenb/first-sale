import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, useId } from "react";
import { Icon, type IconName } from "@/components/icons";
import { IconTile } from "@/components/ui";

// Onramp pieces shared by marketing, branding, website and photos

export function Kicker({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon name={icon} size="sm" />
      {children}
    </span>
  );
}

// A section heading over several cards, with an icon tile or a step number
export function SectionHead({ id, icon, number, title, lead, children }: { id: string; icon?: IconName; number?: number; title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3.5">
      {number !== undefined ? <StepNumber n={number} /> : icon ? <IconTile icon={icon} big /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">
        <h2 id={id} tabIndex={-1} className="scroll-mt-6 font-display text-[22px] leading-snug outline-none">
          {number !== undefined ? <span className="sr-only">Step {number}: </span> : null}
          {title}
        </h2>
        {lead ? <p className="max-w-2xl text-muted">{lead}</p> : null}
        {children}
      </div>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl border border-accent-ring bg-accent-tint font-display text-lg text-accent">
      {n}
    </span>
  );
}

// Onramp's "do this next" card: a ruled margin, a kicker and a serif headline
export function NextUp({ id, icon, kicker, title, children }: { id: string; icon: IconName; kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="relative flex flex-col gap-3.5 rounded-2xl border border-line bg-surface py-5 pr-5 pl-[34px] shadow-lift before:absolute before:inset-y-0 before:left-[18px] before:w-[1.5px] before:bg-accent-ring sm:py-6 sm:pr-6 sm:pl-[46px] sm:before:left-7"
    >
      <div className="flex items-center gap-3">
        <IconTile icon={icon} big />
        <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-accent">{kicker}</p>
      </div>
      <h2 id={id} className="font-display text-[23px] leading-tight sm:text-[27px]">
        {title}
      </h2>
      {children}
    </section>
  );
}

// An accent note for things the owner has done or approved
export function Done({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-fit max-w-full items-start gap-2.5 rounded-xl border border-accent-ring bg-accent-tint px-3.5 py-3 text-[15px] font-semibold text-accent-ink">
      <Icon name="check" size="sm" className="mt-0.5" strokeWidth={2.4} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// Ruled label and value rows
export function InfoRows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="flex flex-col">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-wrap gap-x-4 gap-y-0.5 border-b border-line py-2.5 last:border-b-0">
          <dt className="w-full text-[15px] text-muted sm:w-44 sm:shrink-0">{row.label}</dt>
          <dd className="min-w-0 flex-1 font-semibold">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// A small white box inside a card, for one item or one choice
export const BOX = "rounded-xl border border-line bg-surface shadow-soft";
// A quiet tinted box inside a card, for tips and extra detail
export const SOFT = "rounded-xl border border-line bg-soft";
export const LABEL = "text-[13px] font-bold uppercase tracking-[0.08em] text-muted";
// A why or how line under a question
export function Why({ id, label = "Why we ask", children }: { id?: string; label?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-2 text-[15px] text-muted">
      <Icon name="info" size="sm" className="mt-[3px] text-accent" />
      <span>
        <b className="font-bold text-rule">{label}:</b> {children}
      </span>
    </p>
  );
}

// Pick tiles: rounded cards that show a check mark when picked
const TILE_BASE =
  "group/pick flex w-full rounded-xl border border-line-strong bg-surface font-semibold leading-snug text-ink shadow-soft transition hover:border-muted";
const TILE_ON =
  "aria-pressed:border-accent aria-pressed:shadow-[0_0_0_3px_var(--color-accent-tint)] has-checked:border-accent has-checked:shadow-[0_0_0_3px_var(--color-accent-tint)]";
const TILE_LAYOUT = {
  row: "min-h-12 items-center gap-3 px-3.5 py-2.5 text-left text-[15.5px]",
  top: "min-h-12 items-start gap-3 px-3.5 py-3 text-left text-[15.5px]",
  word: "min-h-11 items-center gap-2.5 px-3 py-2 text-left text-[15px]",
  stack: "min-h-[68px] flex-col items-center justify-center gap-1.5 px-2 py-2 text-center text-[15px]",
};

function PickMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-[22px] shrink-0 place-items-center rounded-full border-[1.5px] border-line-strong bg-surface text-white transition group-aria-pressed/pick:border-accent group-aria-pressed/pick:bg-accent group-has-checked/pick:border-accent group-has-checked/pick:bg-accent"
    >
      <Icon name="check" size="xs" strokeWidth={3} className="opacity-0 group-aria-pressed/pick:opacity-100 group-has-checked/pick:opacity-100" />
    </span>
  );
}

function TileBody({ label, description, lead, labelId, descriptionId }: { label: ReactNode; description?: ReactNode; lead?: ReactNode; labelId?: string; descriptionId?: string }) {
  return (
    <>
      {lead}
      {description ? (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span id={labelId}>{label}</span>
          <span id={descriptionId} className="text-sm font-normal text-muted">
            {description}
          </span>
        </span>
      ) : (
        <span className="min-w-0">{label}</span>
      )}
    </>
  );
}

type TileContent = { label: ReactNode; description?: ReactNode; lead?: ReactNode; layout?: keyof typeof TILE_LAYOUT; descriptionId?: string };

// A toggle button tile, for picks that click on and off
export function PickTile({ pressed, label, description, lead, layout = "row", descriptionId, className = "", ...button }: TileContent & { pressed: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  const uid = useId();
  const about = descriptionId ?? `${uid}-about`;
  // The label names the tile; the description is read after it
  const names = description ? { "aria-labelledby": `${uid}-label`, "aria-describedby": about } : {};
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`${TILE_BASE} ${TILE_ON} ${TILE_LAYOUT[layout]} disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-line-strong ${className}`}
      {...names}
      {...button}
    >
      <PickMark />
      <TileBody label={label} description={description} lead={lead} labelId={`${uid}-label`} descriptionId={about} />
    </button>
  );
}

// A radio or checkbox tile, for native form choices
export function PickOption({ label, description, lead, layout = "row", descriptionId, className = "", ...input }: TileContent & { className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "className">) {
  return (
    <label
      className={`${TILE_BASE} ${TILE_ON} ${TILE_LAYOUT[layout]} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent has-disabled:cursor-not-allowed has-disabled:opacity-45 ${className}`}
    >
      <input className="sr-only" {...input} />
      <PickMark />
      <TileBody label={label} description={description} lead={lead} descriptionId={descriptionId} />
    </label>
  );
}

// Grid sizes for pick tiles
export const PICKS = {
  words: "grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2",
  cards: "grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-2",
  wide: "grid gap-2 sm:grid-cols-2",
};

// Two or three views of one thing, like Computer and Phone
export function Segmented({ label, options, value, onChange }: { label: string; options: { value: string; label: string; icon?: IconName }[]; value: string; onChange: (value: string) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex w-fit gap-1 rounded-xl border border-line bg-wash p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className="inline-flex min-h-11 items-center gap-2 rounded-[9px] px-3.5 text-[15px] font-semibold text-muted transition hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-soft"
        >
          {option.icon ? <Icon name={option.icon} size="sm" /> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}

// A step's tick box: a checkbox drawn as Onramp's rounded tick, with a pen check that draws in when just ticked
export function TickBox({ id, checked, fresh, disabled, onChange }: { id: string; checked: boolean; fresh?: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="grid size-11 shrink-0 cursor-pointer place-items-center has-disabled:cursor-wait">
      <input id={id} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span
        aria-hidden="true"
        className="grid size-[30px] place-items-center rounded-[9px] border-[1.5px] border-line-strong bg-surface text-accent transition hover:border-muted peer-checked:border-accent-ring peer-checked:bg-accent-tint peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-60"
      >
        {checked ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={fresh ? "pen-draw" : undefined}>
            <path d="M5 12.5c1.6 1.3 2.8 2.7 3.9 4.4 2.6-4.6 5.9-8.2 10.1-10.9" />
          </svg>
        ) : null}
      </span>
    </label>
  );
}
