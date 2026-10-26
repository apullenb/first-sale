import type { VerificationState } from "@/lib/domain";
import { isAllowedHost } from "./source-pack";

export interface RetrievedSource {
  id: string;
  url: string;
  retrievedAt: string;
}

export type Verified<T> = T & { verification: VerificationState; problems: string[] };

// A claim counts as sourced only if every source it cites was actually retrieved from an allowed host.
export function verifyCitations<T extends { sourceIds: readonly string[] }>(
  claims: readonly T[],
  retrieved: readonly RetrievedSource[],
  allowedHosts: readonly string[],
): Verified<T>[] {
  const byId = new Map(retrieved.map((source) => [source.id, source]));

  return claims.map((claim) => {
    const problems: string[] = [];
    if (claim.sourceIds.length === 0) problems.push("No source cited");

    for (const id of claim.sourceIds) {
      const source = byId.get(id);
      if (!source) {
        problems.push(`Cited source "${id}" was not retrieved`);
      } else if (!isAllowedHost(source.url, allowedHosts)) {
        problems.push(`Source "${id}" is not on an approved official site`);
      }
    }

    return {
      ...claim,
      verification: problems.length === 0 ? "sourced" : "needs_verification",
      problems,
    };
  });
}
