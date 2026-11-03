// Each progress count names what it counts, since stages, menu steps and tasks have different totals
export const MEASURES = {
  setup: { name: "Business setup", unit: ["stage", "stages"] },
  launch: { name: "Launch requirements", unit: ["task", "tasks"] },
  start: { name: "Start your business", unit: ["step", "steps"] },
  brand: { name: "Build your brand", unit: ["step", "steps"] },
  marketing: { name: "Marketing", unit: ["task", "tasks"] },
  run: { name: "Run your business", unit: ["step", "steps"] },
} as const;

export type Measure = keyof typeof MEASURES;

const unitOf = (measure: Measure, count: number) => MEASURES[measure].unit[count === 1 ? 0 : 1];

// "Launch requirements: 0 of 5 tasks"
export function progressLabel(measure: Measure, done: number, total: number): string {
  return `${MEASURES[measure].name}: ${done} of ${total} ${unitOf(measure, total)}`;
}

// The menu's sections, by their group name
export const SECTION_MEASURES: Record<"Start your business" | "Build your brand" | "Run your business", Measure> = {
  "Start your business": "start",
  "Build your brand": "brand",
  "Run your business": "run",
};
