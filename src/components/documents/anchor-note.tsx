import type { Anchor } from "@/lib/documents/types";

// Where on the form an explanation or answer comes from
export function AnchorNote({ anchor, missing = "We couldn’t point to this on the form", on = "On the form" }: { anchor: Anchor | null; missing?: string; on?: string }) {
  if (!anchor) return <p className="text-[14.5px] text-muted">{missing}</p>;
  return (
    <p className="text-[14.5px] text-muted">
      <span className="font-semibold text-rule">
        {on}, page {anchor.page}
      </span>
      {anchor.excerpt ? <>: “{anchor.excerpt}”</> : null}
    </p>
  );
}
