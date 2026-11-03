import { z } from "zod";
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
export function requestDate(value: string): string {
  const source = value.trim();
  if (z.iso.date().safeParse(source).success) return source;
  const numeric = source.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const named = source.match(
    /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i,
  );
  const month = numeric
    ? Number(numeric[1])
    : named
      ? MONTHS.findIndex(
          (entry) =>
            entry === named[1].toLowerCase() ||
            entry.slice(0, 3) === named[1].toLowerCase(),
        ) + 1
      : 0;
  if (!month) return "";
  const day = numeric?.[2] ?? named?.[2],
    year = numeric?.[3] ?? named?.[3];
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return z.iso.date().safeParse(iso).success ? iso : "";
}
export function requestTime(value: string): string {
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
  const match = value.trim().match(/^(\d{1,2})(?::([0-5]\d))?\s*(am|pm)$/i);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) return "";
  return `${String((Number(match[1]) % 12) + (match[3].toLowerCase() === "pm" ? 12 : 0)).padStart(2, "0")}:${match[2] ?? "00"}`;
}
