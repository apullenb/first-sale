import type { CategoryIcon as IconName } from "@/lib/intake/catalog";

// Simple line icons for business kinds; always shown next to a text label
const PATHS: Record<IconName, string[]> = {
  cake: ["M4 21h16", "M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7", "M5 16c2 1 3-1 5 0s3 1 5 0 3-1 4 0", "M12 12V8", "M12 5.5a1 1 0 0 1 0-2"],
  jar: ["M8 3h8", "M7 6h10", "M7 6v13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6", "M9 12h6"],
  pot: ["M3 10h18", "M5 10v7a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-7", "M9 6c0-1 1-1 1-2", "M14 6c0-1 1-1 1-2"],
  saw: ["M4 20 18 6", "M15 3l6 6", "M6 18l-2 2", "M9 15l2 2", "M12 12l2 2"],
  brush: ["M14 4l6 6-8 8-6-6z", "M6 12l-3 7 7-3"],
  shirt: ["M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3", "M8 3a4 4 0 0 0 8 0"],
  bag: ["M5 8h14l-1 13H6z", "M9 8V6a3 3 0 0 1 6 0v2"],
  scissors: ["M6 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0", "M6 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0", "M20 4 8.5 15.5", "M14.5 14.5 20 20", "M8.5 8.5 12 12"],
  home: ["M3 11 12 4l9 7", "M5 10v10h14V10", "M10 20v-6h4v6"],
  book: ["M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z", "M4 19V5", "M8 7h7"],
  camera: ["M4 8h4l2-3h4l2 3h4v11H4z", "M12 13m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0"],
  spark: ["M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4", "M6 6l2.5 2.5", "M15.5 15.5 18 18", "M18 6l-2.5 2.5", "M8.5 15.5 6 18"],
};

export function CategoryIcon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
