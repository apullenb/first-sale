import "server-only";
import type { ContactItemView } from "@/components/contact/contact-setup";
import { getMyDetails, listMyJourneyMarks } from "@/lib/data/my-business";
import { CONTACT_DETAIL, CONTACT_ITEMS, type ContactItem, type ContactStatus, contactStatus } from "@/lib/rules/contact-setup";

// The signed-in owner's business email and phone: where each stands, and what's saved
export async function getMyContactSetup(): Promise<{ status: ContactStatus; items: Record<ContactItem, ContactItemView> }> {
  const [details, marks] = await Promise.all([getMyDetails(), listMyJourneyMarks()]);
  const status = contactStatus(
    details.map((detail) => detail.key),
    marks.map((mark) => mark.key),
  );
  const items = Object.fromEntries(
    CONTACT_ITEMS.map((item): [ContactItem, ContactItemView] => [
      item,
      { state: status.items[item], value: details.find((detail) => detail.key === CONTACT_DETAIL[item])?.value ?? null },
    ]),
  ) as Record<ContactItem, ContactItemView>;
  return { status, items };
}
