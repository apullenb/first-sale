import type { Anchor } from "@/lib/documents/types";

// Where on the form an explanation or answer comes from
export function AnchorNote({ anchor, missing = "We couldn’t point to this on the form" }: { anchor: Anchor | null; missing?: string }) {
  if (!anchor) return <p className="text-sm text-muted">{missing}</p>;
  return (
    <p className="text-sm text-rule">
      <span className="font-semibold">On the form, page {anchor.page}</span>
      {anchor.excerpt ? <>: “{anchor.excerpt}”</> : null}
    </p>
  );
}
