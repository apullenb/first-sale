// Which logo a logo was made from, so the owner's uploads and their edits can be listed together

export interface LogoNode {
  id: string;
  kind: string;
  origin: string;
  conceptId: string | null;
  sourceId: string | null;
}

// The logos this one was edited from, nearest first
export function ancestorIds(files: readonly LogoNode[], id: string): string[] {
  const byId = new Map(files.map((file) => [file.id, file]));
  const found: string[] = [];
  for (let next = byId.get(id)?.sourceId ?? null; next && !found.includes(next); next = byId.get(next)?.sourceId ?? null) {
    if (byId.get(next)?.kind !== "logo") break;
    found.push(next);
  }
  return found;
}

export interface OwnLogo<T> {
  file: T;
  // 0 for an upload, 1 for an edit of it, and so on
  depth: number;
  // The chosen logo was made from it, so removing it removes the chosen logo too
  holdsChosen: boolean;
}

// The owner's uploads, each followed by its edits, without the chosen logo or ones shown elsewhere on the page
export function ownLogos<T extends LogoNode>(files: readonly T[], chosenId: string | null, shownElsewhere: ReadonlySet<string> = new Set()): OwnLogo<T>[] {
  const own = files.filter((file) => file.kind === "logo" && file.conceptId === null);
  const holding = new Set(chosenId ? ancestorIds(files, chosenId) : []);
  const listed: OwnLogo<T>[] = [];
  const visit = (file: T, depth: number) => {
    if (file.id !== chosenId && !shownElsewhere.has(file.id)) listed.push({ file, depth, holdsChosen: holding.has(file.id) });
    for (const edit of own.filter((each) => each.sourceId === file.id)) visit(edit, depth + 1);
  };
  for (const upload of own.filter((file) => file.origin === "uploaded")) visit(upload, 0);
  return listed;
}
