import type { IconName } from "@/components/icons";
import type { PlanTopic } from "@/lib/domain";

export const TOPIC_ICONS: Record<PlanTopic, IconName> = {
  structure: "scale",
  name_registration: "tag",
  tax_registration: "receipt",
  license_permit: "clipboard",
  location_zoning: "pin",
  employer: "users",
  other: "checklist",
};
