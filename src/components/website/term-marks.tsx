import { Icon, type IconName } from "@/components/icons";
import { STATUS_LABELS, type TermId, type TermStatus } from "@/lib/website/terms";

// One icon per term, used in "New to websites?" and on every package, so each term is spotted at a glance

export const TERM_ICONS: Record<TermId, IconName> = {
  domain: "link",
  hosting: "server",
  builder: "layers",
  checkout: "cart",
  email: "mail",
};

const STATUS_STYLE: Record<TermStatus, { icon: IconName; chip: string; tile: string }> = {
  included: { icon: "check", chip: "border-accent-ring bg-accent-tint text-accent-ink", tile: "border-accent-ring bg-accent-tint text-accent" },
  extra: { icon: "plus", chip: "border-check-ring bg-check-tint text-check", tile: "border-check-ring bg-check-tint text-check" },
  not_included: { icon: "minus", chip: "border-line bg-wash text-muted", tile: "border-line bg-wash text-muted" },
};

export function TermTile({ term, status }: { term: TermId; status?: TermStatus }) {
  const tone = status ? STATUS_STYLE[status].tile : "border-accent-ring bg-accent-tint text-accent";
  return (
    <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-[10px] border ${tone}`}>
      <Icon name={TERM_ICONS[term]} />
    </span>
  );
}

export function StatusChip({ status }: { status: TermStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span className={`inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-[13px] font-bold leading-none ${style.chip}`}>
      <Icon name={style.icon} size="xs" strokeWidth={2.4} />
      {STATUS_LABELS[status]}
    </span>
  );
}
