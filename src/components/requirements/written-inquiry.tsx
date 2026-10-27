import type { Inquiry } from "@/lib/research/inquiry";
import { CopyText } from "./copy-text";

// A prepared question to send in writing, with the best official link to send it from; calling is never required
export function WrittenInquiry({ inquiry, office, link }: { inquiry: Inquiry; office: string; link: { title: string; url: string } | null }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p>
        {office ? <>Send this to {office}. </> : null}
        {link ? "Look for a contact form or email address on their official site, starting here:" : "We didn’t find their official site yet. Many offices list an email address on their county or city website."}
      </p>
      {link ? (
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 w-fit items-center font-semibold text-accent-ink underline underline-offset-4">
          {link.title}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : null}
      <div className="flex flex-col gap-1 rounded-xl bg-surface px-3.5 py-3 ring-1 ring-ink/10">
        <p className="text-sm font-semibold text-muted">Subject: {inquiry.subject}</p>
        <p className="whitespace-pre-line text-[15px]">{inquiry.body}</p>
      </div>
      <CopyText text={`${inquiry.subject}\n\n${inquiry.body}`} label="Copy the message" />
    </div>
  );
}
