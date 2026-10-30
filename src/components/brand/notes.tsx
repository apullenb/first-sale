import { connection } from "next/server";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { TEXT_LINK } from "@/components/styles";
import { Card } from "@/components/ui";
import { getImageModel, getModel } from "@/lib/ai";
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
    <Card title="Good to know" icon="info" tone="gray" id="brand-notes-heading" bodyClassName="gap-5">
      <Note icon="search" title="Check your logo isn’t taken">
        <p className="text-rule">
          A logo made with AI can look like a mark another business already uses, and using one that’s too close can cause trouble later. Before you print it or
          spend money on it, search the{" "}
          <a href={USPTO.url} target="_blank" rel="noreferrer" className={TEXT_LINK}>
            U.S. trademark database
          </a>{" "}
          for similar names and designs (link checked {CHECKED}). A trademark attorney can do a fuller search. First Sale doesn’t check this for you.
        </p>
      </Note>
      <Note icon="lock" title="Who sees your brand files">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-rule marker:text-accent">
          <li>Your brief, ideas and pictures are stored in First Sale’s database. Only you can see them, when you’re signed in.</li>
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
