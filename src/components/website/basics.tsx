import { TERM_LABELS, type TermId } from "@/lib/website/terms";
import { StatusChip, TermTile } from "./term-marks";

// Plain-words explainer for owners who've never made a website. The example address uses their own name.
export function WebsiteBasics({ exampleDomain }: { exampleDomain: string }) {
  const terms: { term: TermId; also?: string; text: string }[] = [
    {
      term: "domain",
      also: "domain or URL",
      text: `What people type to find you, like ${exampleDomain}. You rent it by the year from a company that sells web addresses, often the site builder you pick.`,
    },
    {
      term: "hosting",
      text: "The computers that keep your site online day and night, so it opens whenever someone visits.",
    },
    {
      term: "builder",
      text: "The tool that turns your words and pictures into pages, with no code. With Square, Wix or Shopify you build it yourself; with a First Sale site, First Sale builds it for you.",
    },
    {
      term: "checkout",
      text: "Where customers pick what they want and pay. A payment provider, like Square, Stripe or PayPal, takes the card payment, keeps a small fee from each sale and pays the rest into your bank account. You never handle card numbers.",
    },
    {
      term: "email",
      text: `An address like you@${exampleDomain}. It’s separate from your web address: some hosting packages include it, and the company you bought your web address from often adds it for an extra cost.`,
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-rule">These are the pieces you’ll need to be online, so it helps to know them before you choose a package.</p>
      <ul className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        {terms.map((item) => (
          <li key={item.term} className="flex items-start gap-3">
            <TermTile term={item.term} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="font-bold">
                {TERM_LABELS[item.term]}
                {item.also ? <span className="font-normal text-muted"> ({item.also})</span> : null}
              </p>
              <p className="text-[15px] text-rule">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 border-t border-line pt-3.5">
        <p className="text-[15px] text-rule">Each package below marks these with the same icons:</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[15px] text-muted">
          <li className="flex items-center gap-2">
            <StatusChip status="included" /> in the price
          </li>
          <li className="flex items-center gap-2">
            <StatusChip status="extra" /> you pay more for it
          </li>
          <li className="flex items-center gap-2">
            <StatusChip status="not_included" /> get it somewhere else
          </li>
        </ul>
      </div>
    </div>
  );
}
