import { CARD, SECTION_TITLE } from "@/components/styles";
import { getImageModel, getModel } from "@/lib/ai";

// Where photos go depends on which AI service this copy of First Sale is set up with
function servicePoints(): string[] {
  let model;
  let image;
  try {
    model = getModel();
    image = getImageModel();
  } catch {
    return ["First Sale’s AI service isn’t set up right now, so photos aren’t sent anywhere."];
  }
  if (model.simulated) {
    return ["First Sale is in practice mode: photos aren’t sent to any AI service, and each “edit” is a preview of your original."];
  }
  const sent = "When you check or edit a photo, it’s sent to";
  if (model.name !== "Meta Muse") {
    return [`${sent} the AI service this copy of First Sale is set up with (${model.name}) to be checked. Its own terms say how it handles them.`];
  }
  const points = [
    `${sent} Meta’s AI service (Muse) to be checked and edited.${image ? " Edits use your photo only: the editor’s own web and image search are turned off." : ""}`,
  ];
  if (/contributor/i.test(model.model) || (image && /contributor/i.test(image.model))) {
    points.push("This copy of First Sale uses Meta’s Contributor mode, which lets Meta use what’s sent to train its models.");
  } else {
    points.push(
      "First Sale uses Meta’s Standard mode, which Meta says doesn’t use your content to train its models.",
      "Meta’s documentation doesn’t say how long it keeps requests, so we can’t promise more than that.",
    );
  }
  return points;
}

export function HowPhotosAreHandled() {
  const points = [
    "Your photos are stored in First Sale’s database. They can only be seen when you’re signed in to your account.",
    "Your original photo is never changed. Each edit is saved as a separate version, exactly as it came back.",
    "Photos are kept until you delete them. Deleting a photo removes the original and every version of it.",
    "Copies may remain in database backups kept by our hosting provider until those backups expire.",
    ...servicePoints(),
    "Nothing is published for you. Approved photos wait in your library until you download them.",
  ];
  return (
    <section aria-labelledby="photos-handled-heading" className={`${CARD} flex flex-col gap-3`}>
      <h2 id="photos-handled-heading" className={SECTION_TITLE}>
        How your photos are handled
      </h2>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-rule">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </section>
  );
}
