import type { JurisdictionLevel, PlanTopic } from "./domain";

export const TOPIC_LABELS: Record<PlanTopic, string> = {
  structure: "Business structure",
  name_registration: "Business name",
  tax_registration: "Tax registration",
  license_permit: "License or permit",
  location_zoning: "Location and zoning",
  employer: "Hiring",
  other: "Other step",
};

export const LEVEL_LABELS: Record<JurisdictionLevel, string> = {
  federal: "Federal",
  state: "State",
  county: "County",
  city: "City",
};
