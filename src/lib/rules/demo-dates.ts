// Due dates from a sample email's wording, only where the words fix one exact day

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const ORDINAL = "(\\d{1,2})(?:st|nd|rd|th)";

const parts = (date: string) => date.split("-").map(Number) as [number, number, number];
const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
// Null when that day doesn't exist, like Feb 30
function real(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

// "Saturday": the next one after today
function nextWeekday(weekday: number, today: string): string {
  const [year, month, day] = parts(today);
  const now = new Date(Date.UTC(year, month - 1, day));
  const ahead = (weekday - now.getUTCDay() + 7) % 7 || 7;
  const date = new Date(now.getTime() + ahead * 86_400_000);
  return date.toISOString().slice(0, 10);
}

// The first month from today's on whose day N is on or after today, and the right weekday if one is named
function nextMonthDay(day: number, today: string, weekday: number | null): string | null {
  const [year, month] = parts(today);
  for (let step = 0; step < 48; step++) {
    const y = year + Math.floor((month - 1 + step) / 12);
    const m = ((month - 1 + step) % 12) + 1;
    const date = real(y, m, day);
    if (!date || iso(y, m, day) < today) continue;
    if (weekday === null || date.getUTCDay() === weekday) return iso(y, m, day);
  }
  return null;
}

// "December 15": this year's, or next year's once it has passed
function nextDate(month: number, day: number, today: string): string | null {
  const [year] = parts(today);
  for (const y of [year, year + 1, year + 2, year + 3, year + 4]) {
    if (real(y, month, day) && iso(y, month, day) >= today) return iso(y, month, day);
  }
  return null;
}

export function dueDateFromWording(when: string, today: string): string | null {
  const text = when.toLowerCase();
  const weekdays = WEEKDAYS.join("|");
  const months = MONTHS.join("|");
  let match = new RegExp(`\\b(${weekdays}),? the ${ORDINAL}\\b`).exec(text);
  if (match) return nextMonthDay(Number(match[2]), today, WEEKDAYS.indexOf(match[1]));
  match = new RegExp(`\\b(${months}) (\\d{1,2})(?:st|nd|rd|th)?\\b`).exec(text);
  if (match) return nextDate(MONTHS.indexOf(match[1]) + 1, Number(match[2]), today);
  match = new RegExp(`\\b(${weekdays})\\b`).exec(text);
  if (match) return nextWeekday(WEEKDAYS.indexOf(match[1]), today);
  match = new RegExp(`\\bthe ${ORDINAL}\\b`).exec(text);
  if (match) return nextMonthDay(Number(match[1]), today, null);
  return null;
}
