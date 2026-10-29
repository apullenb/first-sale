import { Icon } from "@/components/icons";
import type { Inquiry } from "@/lib/research/inquiry";
import { CopyText } from "./copy-text";

// A prepared question to send in writing, with the best official link to send it from; calling is never required
export function WrittenInquiry({ inquiry, office, link }: { inquiry: Inquiry; office: string; link: { title: string; url: string } | null }) {
  return (
    <div className="flex flex-col gap-3">
      <p>
        {office ? <>Send this to {office}. </> : null}
        {link ? "Look for a contact form or email address on their official site, starting here:" : "We didn’t find their official site yet. Many offices list an email address on their county or city website."}
      </p>
      {link ? (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 w-full max-w-xl items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2 font-semibold shadow-soft transition hover:border-line-strong motion-reduce:transition-none"
        >
          <Icon name="globe" className="text-accent" />
          <span className="min-w-0 flex-1">{link.title}</span>
          <Icon name="external" size="sm" className="text-faint" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : null}
      <div className="rounded-[10px] border border-line bg-soft p-3.5">
        <p className="mb-1.5 text-sm font-bold text-muted">Subject: {inquiry.subject}</p>
        <p className="whitespace-pre-line text-[15px] leading-relaxed">{inquiry.body}</p>
      </div>
      <CopyText text={`${inquiry.subject}\n\n${inquiry.body}`} label="Copy the message" />
    </div>
  );
}
