import Link from "next/link";
import { Icon } from "@/components/icons";
import { EmailDemo } from "@/components/operations/email-demo";
import { PageHead } from "@/components/ui";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/email/demo");

// Sample-data walkthrough of a connected inbox until connecting email opens to owners
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
        lead="SnapStart reads your customer emails and turns them into orders, quote requests and ready-to-send replies for you to check."
      />
      <EmailDemo />
    </div>
  );
}
