import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { EYEBROW } from "@/components/styles";
import { DocumentTitle } from "./document-title";
import { BackToLibrary } from "./parts";

// Back link, kicker, the renamable title and a lead line, at the top of every document page
export function DocumentHead({ documentId, title, children }: { documentId: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <BackToLibrary />
      <p className={`${EYEBROW} mt-2 inline-flex items-center gap-2`}>
        <Icon name="book" size="sm" />
        Start your business · Step 5
      </p>
      <DocumentTitle key={title} documentId={documentId} title={title} />
      <div className="flex max-w-2xl flex-col gap-1 text-[17px] text-muted">{children}</div>
    </div>
  );
}
