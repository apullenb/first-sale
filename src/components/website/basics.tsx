import { CARD, SECTION_TITLE } from "@/components/styles";

// Plain-words explainer for owners who've never made a website. The example address uses their own name.
export function WebsiteBasics({ exampleDomain }: { exampleDomain: string }) {
  const terms = [
    {
      term: "Web address (also called a URL or domain)",
      text: `What people type to find your site, like ${exampleDomain}. The part you own is the name before “.com”. You rent it by the year from a company called a registrar, often through the site builder you choose.`,
    },
    {
      term: "Hosting",
      text: "The computers that keep your site online all day and every day, so it opens when someone visits. Every option below includes hosting, so you don’t need to buy it separately.",
    },
    {
      term: "Website builder",
      text: "A service that lets you make pages by filling in boxes and dragging pieces into place, without writing code. Square, Wix and Shopify are builders that also host your site. With a First Sale site, First Sale builds it for you and Netlify hosts it.",
    },
    {
      term: "Online store and checkout",
      text: "The pages where customers pick what they want and pay with a card. Card payments cost a small fee on each sale, taken before the money reaches you.",
    },
  ];
  return (
    <section aria-labelledby="basics-heading" className={`${CARD} flex flex-col gap-3`}>
      <h2 id="basics-heading" className={SECTION_TITLE}>
        New to websites? Four words to know
      </h2>
      <dl className="flex flex-col gap-3">
        {terms.map((item) => (
          <div key={item.term} className="flex flex-col gap-0.5">
            <dt className="font-bold">{item.term}</dt>
            <dd className="text-rule">{item.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
