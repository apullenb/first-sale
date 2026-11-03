import Link from "next/link";
import { Icon } from "@/components/icons";
import { EmailDemo } from "@/components/operations/email-demo";
import { PageHead } from "@/components/ui";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/email/demo");

// Sample-data walkthrough of email forwarding until the inbound service opens to owners
export default function EmailDemoPage() {
  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <Link href="/run" className="-mb-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-muted hover:text-accent">
        <Icon name="back" size="sm" />
        Run your business
      </Link>
      <PageHead
        kicker="Run your business"
        title="Connect your email"
        lead="Forward customer emails to your own SnapStart address. They become orders or requests for you to check, with replies you send from your own email."
      />
      <EmailDemo />
    </div>
  );
}
