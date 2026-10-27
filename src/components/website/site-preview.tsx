import type { SiteLook } from "@/lib/website/look";
import type { WebsiteCopy } from "@/lib/website/types";

// A rough picture of the site with the owner's words. The real site is built on the platform they chose.
export function SitePreview({ copy, name, domain, look, action }: { copy: WebsiteCopy; name: string; domain: string | null; look: SiteLook; action: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-2xl ring-1 ring-ink/10" style={{ background: look.background }}>
        <div aria-hidden="true" className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2 text-xs text-muted">
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="ml-2 truncate rounded bg-ground px-2 py-0.5">{domain ?? "your-web-address.com"}</span>
        </div>
        <div className="flex flex-col gap-6 p-5 sm:p-8">
          <header className="flex items-center gap-3">
            {look.logoUrl ? (
              // Owner's own logo file from their brand kit
              // eslint-disable-next-line @next/next/no-img-element
              <img src={look.logoUrl} alt={`${name} logo`} className="size-12 rounded-lg object-contain" />
            ) : null}
            {/* A light brand color would be hard to read as text, so the name uses dark ink then */}
            <span className="font-display text-xl font-bold" style={{ color: look.onPrimary === "#ffffff" ? look.primary : "#1c2321" }}>
              {name}
            </span>
          </header>
          {look.heroUrl ? (
            // Owner's own hero image from their brand kit
            // eslint-disable-next-line @next/next/no-img-element
            <img src={look.heroUrl} alt="" className="aspect-video w-full rounded-xl object-cover" />
          ) : null}
          <section className="flex flex-col gap-2">
            <p className="font-display text-3xl font-bold leading-tight text-ink wrap-break-word">{copy.headline}</p>
            <p className="text-lg text-rule">{copy.subheadline}</p>
            <p className="text-rule">{copy.intro}</p>
            <span className="mt-1 w-fit rounded-lg px-4 py-2.5 font-bold" style={{ background: look.primary, color: look.onPrimary }}>
              {action}
            </span>
          </section>
          {copy.offerings.length ? (
            <section className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
              {copy.offerings.map((item, index) => (
                <div key={index} className="flex flex-col gap-1 rounded-xl bg-surface p-4 ring-1 ring-ink/5">
                  <div aria-hidden="true" className="mb-1 h-20 rounded-lg bg-ground" />
                  <p className="font-bold">{item.name}</p>
                  <p className="text-sm text-rule">{item.description}</p>
                </div>
              ))}
            </section>
          ) : null}
          <section className="flex flex-col gap-1">
            <p className="font-display text-xl font-bold">About</p>
            <p className="whitespace-pre-line text-rule">{copy.about}</p>
          </section>
          <section className="flex flex-col gap-1">
            <p className="font-display text-xl font-bold">How to buy</p>
            <p className="whitespace-pre-line text-rule">{copy.howToBuy}</p>
          </section>
          {copy.faq.length ? (
            <section className="flex flex-col gap-2">
              <p className="font-display text-xl font-bold">Questions</p>
              {copy.faq.map((entry, index) => (
                <div key={index}>
                  <p className="font-semibold">{entry.question}</p>
                  <p className="text-rule">{entry.answer}</p>
                </div>
              ))}
            </section>
          ) : null}
          <footer className="border-t border-line pt-4 text-sm text-rule">{copy.contact}</footer>
        </div>
      </div>
      <figcaption className="text-sm text-muted">
        A rough preview with your words{look.logoUrl || look.heroUrl ? " and your brand" : ""}. Your real site will use the design you pick on
        the platform you chose.
        {look.practice ? " Your logo and images here are practice previews, not made by the AI service." : ""}
      </figcaption>
    </figure>
  );
}
