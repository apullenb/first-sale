import "server-only";
import places from "@/data/places/places.json";
import type { UsStateCode } from "@/lib/domain";

// County and city suggestions for the place question, from the Census Bureau's lists (scripts/update-places.mjs).
// Owners can still type a place that isn't listed.

export interface PlaceOption {
  // Unique within the state; names can repeat
  id: string;
  name: string;
  // Counties the place reaches; fills the county when there's just one
  counties: string[];
  // A Census-designated community: no city government of its own
  noCityGovernment: boolean;
}

export interface PlaceOptions {
  counties: string[];
  cities: PlaceOption[];
  // Owner-facing note on where the list comes from and how old it is
  source: string;
}

type StateData = { counties: string[]; places: [string, number, number[]][] };

const data = places as unknown as { vintage: string; asOf: string; sources: string[]; states: Record<string, StateData> };
const cache = new Map<UsStateCode, PlaceOptions>();

export const PLACES_AS_OF = data.asOf;

export function placeOptions(state: UsStateCode): PlaceOptions {
  const hit = cache.get(state);
  if (hit) return hit;
  const raw = data.states[state] ?? { counties: [], places: [] };
  const asOf = new Date(`${data.asOf}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const options: PlaceOptions = {
    counties: raw.counties,
    cities: raw.places.map(([name, government, counties], index) => ({
      id: String(index),
      name,
      counties: counties.map((i) => raw.counties[i]).filter(Boolean),
      noCityGovernment: government === 0,
    })),
    source: `Suggestions come from the US Census Bureau’s ${data.vintage} lists of counties and places (updated ${asOf}). Places formed since may be missing, so type yours if it isn’t there.`,
  };
  cache.set(state, options);
  return options;
}
