import type { DocumentOrigin, GeneratedKind } from "@/lib/domain";

// What each document is in the owner's library, apart from where it came from (origin).
// Originals are never changed; drafts, reviewed copies and records of filing are separate rows.

export const DOCUMENT_ROLES = [
  "original",
  "form",
  "answer_guide",
  "reviewed",
  "supporting",
  "receipt",
  "approval",
  "prepared",
  "mail",
] as const;
export type DocumentRole = (typeof DOCUMENT_ROLES)[number];

export const ROLE_LABELS: Record<DocumentRole, string> = {
  original: "Official form, unchanged",
  form: "Form you added",
  answer_guide: "Answers prepared for an online application",
  reviewed: "Reviewed copy, not filed",
  supporting: "Supporting document",
  receipt: "Filing receipt or confirmation",
  approval: "Approval or license",
  prepared: "Prepared by SnapStart",
  mail: "Letter or notice you received",
};

// Roles an owner picks when they upload something themselves
export const UPLOAD_ROLES = ["mail", "approval", "receipt", "supporting"] as const satisfies readonly DocumentRole[];

// Papers the owner already has, as opposed to forms to fill in; explained only when the owner asks
export function isKept(doc: { origin: DocumentOrigin; role: DocumentRole | null }): boolean {
  return doc.origin === "upload" && (UPLOAD_ROLES as readonly (DocumentRole | null)[]).includes(doc.role);
}

// Rows saved before roles existed
export function roleOf(doc: { role: DocumentRole | null; origin: DocumentOrigin; generatedKind: GeneratedKind | null }): DocumentRole {
  if (doc.role) return doc.role;
  if (doc.origin === "official_form") return "original";
  if (doc.origin === "generated") return doc.generatedKind === "filled_form" || doc.generatedKind === "answer_sheet" ? "reviewed" : "prepared";
  return doc.origin === "upload" || doc.origin === "paste" ? "form" : "supporting";
}

export interface Versioned {
  id: string;
  familyId: string | null;
  version: number;
  fromDocumentId: string | null;
  updatedAt: Date;
}

// Groups versions under the first one, newest version first; reviewed copies join the form they came from
export function families<T extends Versioned>(docs: readonly T[]): { root: T; versions: T[] }[] {
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  const rootOf = (doc: T): string => {
    if (doc.familyId && byId.has(doc.familyId)) return doc.familyId;
    if (doc.fromDocumentId && byId.has(doc.fromDocumentId)) return rootOf(byId.get(doc.fromDocumentId)!);
    return doc.id;
  };
  const groups = new Map<string, T[]>();
  for (const doc of docs) {
    const root = rootOf(doc);
    groups.set(root, [...(groups.get(root) ?? []), doc]);
  }
  return [...groups.entries()]
    .map(([rootId, members]) => ({
      root: byId.get(rootId)!,
      versions: members.filter((doc) => doc.id !== rootId).sort((a, b) => b.version - a.version || b.updatedAt.getTime() - a.updatedAt.getTime()),
    }))
    .sort((a, b) => latest(b).getTime() - latest(a).getTime());
}

function latest(group: { root: Versioned; versions: Versioned[] }): Date {
  return [group.root, ...group.versions].reduce((max, doc) => (doc.updatedAt > max ? doc.updatedAt : max), group.root.updatedAt);
}

export function nextVersion(docs: readonly Pick<Versioned, "id" | "familyId" | "version">[], familyId: string): number {
  return Math.max(0, ...docs.filter((doc) => doc.id === familyId || doc.familyId === familyId).map((doc) => doc.version)) + 1;
}
