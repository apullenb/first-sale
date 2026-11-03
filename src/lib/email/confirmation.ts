// Email services confirm a forwarding address by mailing it; these are shown to the owner, never followed

export interface ForwardingConfirmation {
  provider: "Gmail" | "Yahoo" | "Outlook" | "iCloud";
  code: string | null;
  // Only https links on the provider's own domains
  link: string | null;
  receivedAt: string;
}

const PROVIDERS: {
  provider: ForwardingConfirmation["provider"];
  senders: RegExp;
  subject: RegExp;
  hosts: RegExp;
}[] = [
  {
    provider: "Gmail",
    senders: /@(google\.com|gmail\.com)$/i,
    subject: /forwarding confirmation/i,
    hosts: /^(mail|mail-settings|isolated\.mail)\.google\.com$/i,
  },
  {
    provider: "Yahoo",
    senders: /@([a-z0-9-]+\.)*(yahoo\.com|yahoo-inc\.com|yahoomail\.com)$/i,
    subject: /forward|verif|confirm/i,
    hosts: /^([a-z0-9-]+\.)*yahoo\.com$/i,
  },
  {
    provider: "Outlook",
    senders: /@([a-z0-9-]+\.)*(microsoft\.com|outlook\.com)$/i,
    subject: /forward.*(verif|confirm)|(verif|confirm).*forward/i,
    hosts: /^([a-z0-9-]+\.)*(live\.com|outlook\.com|microsoft\.com)$/i,
  },
  {
    provider: "iCloud",
    senders: /@([a-z0-9-]+\.)*(apple\.com|icloud\.com)$/i,
    subject: /forward.*(verif|confirm)|(verif|confirm).*forward/i,
    hosts: /^([a-z0-9-]+\.)*(icloud\.com|apple\.com)$/i,
  },
];

export function detectConfirmation(input: {
  from: string;
  subject: string;
  text: string;
  receivedAt: Date;
}): ForwardingConfirmation | null {
  const from = input.from.trim().toLowerCase();
  const match = PROVIDERS.find(
    (item) => item.senders.test(from) && item.subject.test(input.subject),
  );
  if (!match) return null;
  // Gmail puts the code in the subject, "(#123456789) Gmail Forwarding Confirmation"
  const code =
    input.subject.match(/\(#(\d{4,12})\)/)?.[1] ??
    input.text.match(/confirmation code:?\s*(\d{4,12})/i)?.[1] ??
    input.text.match(/verification code:?\s*(\d{4,12})/i)?.[1] ??
    null;
  let link: string | null = null;
  for (const raw of input.text.match(/https:\/\/[^\s<>"')\]]+/g) ?? []) {
    try {
      const url = new URL(raw.replaceAll("&amp;", "&"));
      if (url.protocol === "https:" && match.hosts.test(url.hostname) && !url.username && !url.password) {
        link = url.toString();
        break;
      }
    } catch {
      /* not a link */
    }
  }
  if (!code && !link) return null;
  return {
    provider: match.provider,
    code,
    link: link && link.length <= 2000 ? link : null,
    receivedAt: input.receivedAt.toISOString(),
  };
}
