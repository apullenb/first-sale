import { Card } from "@/components/ui";
import { getMyContactSetup } from "@/lib/contact-status";
import { CONTACT_STEP_TITLE } from "@/lib/rules/contact-setup";
import { ContactSetup } from "./contact-setup";

// Asked once, right after intake or on Today for owners who finished intake before; if put off, it stays as a step until done
export async function ContactQuestion() {
  const { status, items } = await getMyContactSetup();
  if (status.asked && status.step !== "todo") return null;
  // One card throughout, so a guide the owner just opened stays open as the question turns into a step
  return (
    <Card title={status.asked ? CONTACT_STEP_TITLE : "Do you have a business email and phone?"} icon="file" id="contact-question">
      <p className="text-rule">
        {status.asked
          ? "You saved this for later. Add the ones you have, or follow Google’s steps to set them up."
          : "Customers, forms and your website need a way to reach the business. For each one, add it, get Google’s steps to set one up, or save it for later."}
      </p>
      <ContactSetup items={items} />
    </Card>
  );
}
