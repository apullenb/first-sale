import type { WebsiteCopy } from "@/lib/website/types";

// The parts of the site a demo finish checked
export interface FinishedParts {
  copy: WebsiteCopy | null;
  approved: boolean;
  design: unknown;
}

// A demo finish stands only while the words stay approved and the words and design stay as they were
export function finishStands(before: FinishedParts, after: FinishedParts): boolean {
  return after.approved && JSON.stringify(before.copy) === JSON.stringify(after.copy) && JSON.stringify(before.design) === JSON.stringify(after.design);
}
