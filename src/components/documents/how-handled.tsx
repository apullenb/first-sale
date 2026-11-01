import { Card } from "@/components/ui";
import { serviceNotes, serviceRecipient } from "@/components/ai-service";
import { getModel } from "@/lib/ai";

// What happens to documents sent for help depends on which AI service this copy of SnapStart is set up with
function servicePoints(): string[] {
  let model;
  try {
    model = getModel();
  } catch {
    return ["SnapStart’s AI service isn’t set up right now, so documents aren’t sent anywhere to be read."];
  }
  if (model.simulated || !model.dataHandling) {
    return ["SnapStart is in practice mode: documents aren’t sent to any AI service, and built-in rules stand in for one."];
  }
  return [
    `When SnapStart reads a document you add, or you ask for help with one, its text or images are sent to ${serviceRecipient(model)} to be read.`,
    ...serviceNotes(model),
  ];
}

export function HowDocumentsAreHandled() {
  const points = [
    "Your files are stored in SnapStart’s database. They can only be seen when you’re signed in to your account.",
    "They’re kept until you delete them.",
    "Deleting a document removes the file, its text, explanations and drafted answers. Details you chose to save to your business stay.",
    "Copies may remain in database backups kept by our hosting provider until those backups expire.",
    ...servicePoints(),
    "SnapStart never files or submits anything for you.",
    "When you can, avoid uploading pages that show Social Security numbers.",
  ];
  return (
    <Card title="How your documents are handled" icon="lock" tone="gray" id="handled-heading">
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] text-rule marker:text-faint">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </Card>
  );
}
