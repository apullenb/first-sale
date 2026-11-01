import { Card } from "@/components/ui";
import { serviceNotes, serviceRecipient } from "@/components/ai-service";
import { getImageModel, getModel } from "@/lib/ai";

// Where photos go depends on which AI service this copy of SnapStart is set up with
function servicePoints(): string[] {
  let model;
  let image;
  try {
    model = getModel();
    image = getImageModel();
  } catch {
    return ["SnapStart’s AI service isn’t set up right now, so photos aren’t sent anywhere."];
  }
  if (model.simulated) {
    return ["SnapStart is in practice mode: photos aren’t sent to any AI service, and each “edit” is a preview of your original."];
  }
  const sent = "When you check or edit a photo, it’s sent to";
  return [
    `${sent} ${serviceRecipient(model)} to be checked${image ? " and edited. Edits use your photo only: the editor’s own web and image search are turned off" : ""}.`,
    ...serviceNotes(model, image),
  ];
}

export function HowPhotosAreHandled() {
  const points = [
    "Your photos are stored in SnapStart’s database. They can only be seen when you’re signed in to your account.",
    "Your original photo is never changed. Each edit is saved as a separate version, exactly as it came back.",
    "Photos are kept until you delete them. Deleting a photo removes the original and every version of it.",
    "Copies may remain in database backups kept by our hosting provider until those backups expire.",
    ...servicePoints(),
    "Nothing is published for you. Approved photos wait in your library until you download them.",
  ];
  return (
    <Card title="How your photos are handled" icon="lock" tone="gray" id="photos-handled-heading">
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-rule marker:text-accent">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </Card>
  );
}
