import { Icon } from "@/components/icons";
import { PRIMARY_LINK, TEXT_LINK } from "@/components/styles";
import type { Contacts } from "@/lib/research/contacts";
import type { Inquiry } from "@/lib/research/inquiry";
import { CopyText } from "./copy-text";
import { OutsideLink, ResourceLink } from "@/components/ui";

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
          {link ? "Look for a contact form or email address on their official site, starting here:" : "SnapStart hasn’t verified an official page for this office yet, so there’s no link here. Many offices list an email address on their county or city website."}
        </p>
      )}
      {listed ? (
        <p className="text-sm text-muted">
          Listed on <ResourceLink href={listed.url}>their official site</ResourceLink>.
        </p>
      ) : null}
      {link && !email ? (
        <OutsideLink href={link.url} cue="see">
          {link.title}
        </OutsideLink>
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
