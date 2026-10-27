import { connection } from "next/server";
import { CARD, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import { getImageModel, getModel } from "@/lib/ai";
import { dollars } from "@/lib/brand/cost";
import { CHECKED, USPTO } from "@/lib/brand/sizes";

// Where brand files go depends on which AI service this copy of First Sale is set up with
function servicePoints(): string[] {
  let model;
  let image;
  try {
    model = getModel();
    image = getImageModel();
  } catch {
    return ["First Sale’s AI service isn’t set up right now, so nothing is sent anywhere."];
  }
  if (model.simulated) return ["First Sale is in practice mode: nothing is sent to any AI service, and no pictures are drawn."];
  if (!model.dataHandling) return [`Your brief and files are sent to ${model.name} to write ideas and check spelling.`];
  return [
    `Your brief is sent to ${model.dataHandling.recipient} to write logo ideas, and each picture is sent back to it to check the spelling.`,
    image ? "Pictures are drawn by Meta’s Muse Image from your brief and logo only: its own web and image search are turned off, so it doesn’t copy pictures it finds online." : "Drawing pictures isn’t turned on for this setup.",
    ...model.dataHandling.notes,
  ];
}

// Read when the page is served, not when it's built, so it matches the running setup
export async function BrandNotes() {
  await connection();
  return (
    <section aria-labelledby="brand-notes-heading" className={`${CARD} flex flex-col gap-5`}>
      <h2 id="brand-notes-heading" className={SECTION_TITLE}>
        Good to know
      </h2>
      <div className="flex flex-col gap-1.5">
        <h3 className="font-semibold">Check your logo isn’t taken</h3>
        <p className="text-rule">
          A logo made with AI can look like a mark another business already uses, and using one that’s too close can cause trouble later. Before you print it or
          spend money on it, search the{" "}
          <a href={USPTO.url} target="_blank" rel="noreferrer" className={TEXT_LINK}>
            U.S. trademark database
          </a>{" "}
          for similar names and designs (link checked {CHECKED}). A trademark attorney can do a fuller search. First Sale doesn’t check this for you.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="font-semibold">Who sees your brand files</h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-rule">
          <li>Your brief, ideas and pictures are stored in First Sale’s database. Only you can see them, when you’re signed in.</li>
          <li>Pictures are kept exactly as Muse made them. Exact-size downloads are made in your browser.</li>
          {servicePoints().map((point) => (
            <li key={point}>{point}</li>
          ))}
          <li>Nothing is posted for you. Approved files wait in your brand kit until you download them.</li>
        </ul>
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="font-semibold">What it costs</h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-rule">
          <li>
            Meta charges {dollars(1)} for each picture Muse Image makes, and nothing for ones that fail or are blocked (
            <a href="https://dev.meta.ai/docs/pricing-rate-limits" target="_blank" rel="noreferrer" className={TEXT_LINK}>
              Meta’s pricing
            </a>
            , checked {CHECKED}). Every button says how many pictures it makes.
          </li>
          <li>Writing ideas and checking spelling use Muse Spark, which Meta charges by how much it reads and writes, not per picture.</li>
          <li>If you press a button again after a lost connection, First Sale returns what was already made instead of paying twice.</li>
        </ul>
      </div>
    </section>
  );
}
