import { Note } from "@/components/ui";
import type { DocumentContent } from "@/lib/documents/types";
import { countOf, describeCounts } from "@/lib/privacy/sensitive";

// Says what SnapStart took out of a document, and how the file was kept
export function RemovedNote({ content }: { content: DocumentContent }) {
  if (!countOf(content.removed) && !content.fileRemoved && !content.fileRedacted) return null;
  const what = countOf(content.removed) ? describeCounts(content.removed!) : "private numbers";
  return (
    <Note icon="lock" tone="quiet">
      <p className="font-semibold">SnapStart removed private numbers from this document</p>
      <p>
        {content.fileRedacted
          ? `It blacked out ${what} in the file and took them out of its text, so the copy kept here doesn’t contain them. SnapStart never needs them.`
          : content.fileRemoved
            ? `It took out ${what}. It couldn’t make a blacked-out copy of this file that it could check, so it kept the text without them instead. Keep your original somewhere safe.`
            : `It took out ${what} before saving or reading the text. SnapStart never keeps them, and never sends them to its AI service.`}
      </p>
    </Note>
  );
}
