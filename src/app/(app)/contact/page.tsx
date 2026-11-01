import Link from "next/link";
import { Suspense } from "react";
import { ContactSetup } from "@/components/contact/contact-setup";
import { Icon } from "@/components/icons";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, PageHead } from "@/components/ui";
import { getMyContactSetup } from "@/lib/contact-status";
import { getMyBusiness } from "@/lib/data/my-business";
import { CONTACT_STEP_TITLE } from "@/lib/rules/contact-setup";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/contact");

export default function ContactPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHead
        kicker={
          <span className="inline-flex items-center gap-2">
            <Icon name="file" size="sm" />
            Start your business
          </span>
        }
        title={CONTACT_STEP_TITLE}
        lead="A separate email address and phone number keep customer messages apart from your personal ones. Add the ones you have, or follow Google’s own steps to set them up yourself."
      />
      <Suspense fallback={<p className="text-muted">Loading your contact details…</p>}>
        <Setup />
      </Suspense>
    </div>
  );
}

async function Setup() {
  const [business, contact] = await Promise.all([getMyBusiness(), getMyContactSetup()]);
  if (!business) {
    return (
      <Card title="Tell us about your business first" id="business-first">
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
        </Link>
      </Card>
    );
  }
  return <ContactSetup items={contact.items} guides="open" />;
}
