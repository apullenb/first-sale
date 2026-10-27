// A version's history: each refinement points at the version it changed

interface Linked {
  id: string;
  parentId: string | null;
  refinement: string | null;
}

// The owner's requested changes that led to this version, oldest first
export function changesFor(versions: Linked[], versionId: string): string[] {
  const byId = new Map(versions.map((version) => [version.id, version]));
  const changes: string[] = [];
  const seen = new Set<string>();
  for (let current = byId.get(versionId); current && !seen.has(current.id); current = current.parentId ? byId.get(current.parentId) : undefined) {
    seen.add(current.id);
    if (current.refinement) changes.unshift(current.refinement);
  }
  return changes;
}

// The version a chain of refinements started from
export function firstOf<T extends Linked>(versions: T[], versionId: string): T | null {
  const byId = new Map(versions.map((version) => [version.id, version]));
  const seen = new Set<string>();
  let current = byId.get(versionId);
  while (current?.parentId && byId.has(current.parentId) && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parentId);
  }
  return current ?? null;
}
