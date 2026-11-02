import { Chip } from "@/components/ui";
import { PRACTICE_LABEL } from "@/lib/brand/practice";
import { CODE_MODEL } from "@/lib/brand/types";

export function PracticeTag() {
  return <Chip tone="warn">{PRACTICE_LABEL}</Chip>;
}

const BUILT_IN_CODE = "Made by SnapStart from your logo’s own pixels: nothing was redrawn";

// Who made it: AI, SnapStart from the logo's pixels, or a practice stand-in that must never pass for a drawing
export function MadeBy({ simulated, model, what = "Drawn by AI" }: { simulated: boolean; model?: string; what?: string }) {
  if (simulated) return <PracticeTag />;
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
      {model === CODE_MODEL ? BUILT_IN_CODE : what}
    </span>
  );
}
