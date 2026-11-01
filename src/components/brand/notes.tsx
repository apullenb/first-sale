import { connection } from "next/server";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Card, OutsideLink } from "@/components/ui";
import { getImageModel, getModel } from "@/lib/ai";
import { CHECKED, USPTO } from "@/lib/brand/sizes";

// Where brand files go depends on which AI service this copy of SnapStart is set up with
function servicePoints(): string[] {
  let model;
  let image;
  try {
    model = getModel();
    image = getImageModel();
  } catch {
    return ["SnapStart’s AI service isn’t set up right now, so nothing is sent anywhere."];
  }
  if (model.simulated) return ["SnapStart is in practice mode: nothing is sent to any AI service, and no pictures are drawn."];
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
    <Card title="Good to know" icon="info" tone="gray" id="brand-notes-heading" bodyClassName="gap-5">
      <Note icon="search" title="We recommend a trademark search">
        <p className="text-rule">
          Do it before you print signs, labels or packaging, buy a web address, or file a name with your state. If another business already uses a name or logo
          close to yours for similar goods, they can make you stop using it, and everything printed with it is wasted. It matters most if you’ll sell online or in
          more than one state, since your customers can come from anywhere.
        </p>
        <p className="text-rule">
          Search the U.S. trademark database for your business name and for words and designs like your logo. It’s free. A logo made with AI can look like one
          already in use, so check it too. If your business grows, registering your own trademark protects the name nationwide, and a trademark attorney can handle
          the filing.
        </p>
        <OutsideLink href={USPTO.url} cue="recommended">
          Search the U.S. trademark database
        </OutsideLink>
        <p className="text-sm text-muted">Link checked {CHECKED}.</p>
      </Note>
      <Note icon="lock" title="Who sees your brand files">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-rule marker:text-accent">
          <li>Your brief, ideas and pictures are stored in SnapStart’s database. Only you can see them, when you’re signed in.</li>
          <li>Pictures are kept exactly as Muse made them. Exact-size downloads are made in your browser.</li>
          {servicePoints().map((point) => (
            <li key={point}>{point}</li>
          ))}
          <li>Nothing is posted for you. Files you choose wait in your brand kit and Brand Library until you download them.</li>
        </ul>
      </Note>
    </Card>
  );
}

function Note({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h3 className="flex items-center gap-2 font-bold">
        <Icon name={icon} size="sm" className="text-accent" />
        {title}
      </h3>
      {children}
    </div>
  );
}
