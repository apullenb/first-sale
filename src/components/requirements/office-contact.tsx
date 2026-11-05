import { TEXT_LINK } from "@/components/styles";
import { OutsideLink, ResourceLink } from "@/components/ui";
import type { Contacts } from "@/lib/research/contacts";

// Who can answer for sure: the office's email and phone as its official pages list them, or its official site
export function OfficeContact({ office, contacts, link }: { office: string; contacts: Contacts | null; link: { title: string; url: string } | null }) {
  const email = contacts?.emails[0] ?? null;
  const phone = contacts?.phones[0] ?? null;
  const listed = email ?? phone;
  const name = office || "The office that handles this";
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-line bg-soft p-3.5">
      <p className="font-semibold">{name}</p>
      {email ? (
        <p>
          Email{" "}
          <a href={`mailto:${email.value}`} className={`${TEXT_LINK} break-all`}>
            {email.value}
          </a>
        </p>
      ) : null}
      {phone ? (
        <p>
          Call{" "}
          <a href={`tel:${phone.value.replace(/\D/g, "")}`} className={TEXT_LINK}>
            {phone.value}
          </a>
        </p>
      ) : null}
      {listed ? (
        <p className="text-sm text-muted">
          As listed on <ResourceLink href={listed.url}>their official site</ResourceLink>.
        </p>
      ) : link ? (
        <>
          <p className="text-[15px] text-rule">Their official site lists how to reach them:</p>
          <OutsideLink href={link.url} cue="see">
            {link.title}
          </OutsideLink>
        </>
      ) : (
        <p className="text-[15px] text-rule">Their contact details aren’t on a page SnapStart could confirm yet. Your city or county’s main website lists them.</p>
      )}
    </div>
  );
}
