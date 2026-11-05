import { Chip } from "@/components/ui";
import type { IconName } from "@/components/icons";
import { type RequirementStatus, STATUS_LABELS } from "@/lib/research/applicability";

const LOOK: Record<RequirementStatus, { tone: "accent" | "gray" | "warn" | "plain"; icon: IconName }> = {
  verified: { tone: "accent", icon: "check" },
  quote_unchecked: { tone: "accent", icon: "check" },
  conditional: { tone: "gray", icon: "branch" },
  optional: { tone: "plain", icon: "plus" },
  needs_confirmation: { tone: "accent", icon: "check" },
  outside_coverage: { tone: "plain", icon: "external" },
  not_needed: { tone: "plain", icon: "minus" },
  unlikely: { tone: "plain", icon: "minus" },
  to_find_out: { tone: "warn", icon: "question" },
};

// Whether a requirement applies; the icon only repeats the words
export function RequirementStatusChip({ status }: { status: RequirementStatus }) {
  return (
    <Chip tone={LOOK[status].tone} icon={LOOK[status].icon}>
      {STATUS_LABELS[status]}
    </Chip>
  );
}
