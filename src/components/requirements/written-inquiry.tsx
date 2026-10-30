import { Icon } from "@/components/icons";
import { PRIMARY_LINK, TEXT_LINK } from "@/components/styles";
import type { Contacts } from "@/lib/research/contacts";
import type { Inquiry } from "@/lib/research/inquiry";
import { CopyText } from "./copy-text";

// A prepared question to send in writing, with the office's email and phone when its official pages list them; calling is never required
export function WrittenInquiry({
  inquiry,
  office,
  link,
  contacts = null,
}: {
  inquiry: Inquiry;
  office: string;
  link: { title: string; url: string } | null;
  contacts?: Contacts | null;
}) {
  const email = contacts?.emails[0] ?? null;
  const phone = contacts?.phones[0] ?? null;
  const listed = email ?? phone;
  const mailto = email ? `mailto:${email.value}?subject=${encodeURIComponent(inquiry.subject)}&body=${encodeURIComponent(inquiry.body)}` : null;
  return (
    <div className="flex flex-col gap-3">
      {email ? (
        <p>
          Email this message to {office ? <>{office} at </> : null}
          <a href={`mailto:${email.value}`} className={`${TEXT_LINK} break-all`}>
            {email.value}
          </a>
          .{" "}
          {phone ? (
            <>
              Or call{" "}
              <a href={`tel:${phone.value.replace(/\D/g, "")}`} className={TEXT_LINK}>
                {phone.value}
              </a>
              .
            </>
          ) : null}
        </p>
      ) : (
        <p>
          {office ? <>Send this to {office}. </> : null}
          {phone ? (
            <>
              Their official site lists{" "}
              <a href={`tel:${phone.value.replace(/\D/g, "")}`} className={TEXT_LINK}>
                {phone.value}
              </a>{" "}
              if you’d rather call.{" "}
            </>
          ) : null}
          {link ? "Look for a contact form or email address on their official site, starting here:" : "We didn’t find their official site yet. Many offices list an email address on their county or city website."}
        </p>
      )}
      {listed ? (
        <p className="text-sm text-muted">
          Listed on{" "}
          <a href={listed.url} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
            their official site
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </p>
      ) : null}
      {link && !email ? (
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
      <div className="flex flex-wrap items-center gap-3">
        {mailto ? (
          <a href={mailto} className={`${PRIMARY_LINK} w-fit`}>
            <Icon name="mail" size="sm" />
            Email this message
          </a>
        ) : null}
        <CopyText text={`${inquiry.subject}\n\n${inquiry.body}`} label="Copy the message" />
      </div>
    </div>
  );
}
