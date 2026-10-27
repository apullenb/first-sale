import { CARD, SECTION_TITLE } from "@/components/styles";
import { getModel } from "@/lib/ai";

// What happens to documents sent for help depends on which AI service this copy of First Sale is set up with
function servicePoints(): string[] {
  let model;
  try {
    model = getModel();
  } catch {
    return ["First Sale’s AI service isn’t set up right now, so documents aren’t sent anywhere to be read."];
  }
  if (model.simulated || !model.dataHandling) {
    return ["First Sale is in practice mode: documents aren’t sent to any AI service, and built-in rules stand in for one."];
  }
  return [
    `When First Sale reads a document you add, or you ask for help with one, its text or images are sent to ${model.dataHandling.recipient} to be read.`,
    ...model.dataHandling.notes,
  ];
}

export function HowDocumentsAreHandled() {
  const points = [
    "Your files are stored in First Sale’s database. They can only be seen when you’re signed in to your account.",
    "They’re kept until you delete them.",
    "Deleting a document removes the file, its text, explanations and drafted answers. Details you chose to save to your business stay.",
    "Copies may remain in database backups kept by our hosting provider until those backups expire.",
    ...servicePoints(),
    "First Sale never files or submits anything for you.",
    "When you can, avoid uploading pages that show Social Security numbers.",
  ];
  return (
    <section aria-labelledby="handled-heading" className={`${CARD} flex flex-col gap-3`}>
      <h2 id="handled-heading" className={SECTION_TITLE}>
        How your documents are handled
      </h2>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-rule">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </section>
  );
}
