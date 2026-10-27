import { ActorChip } from "@/components/actor-chip";
import { FLAG_LABELS } from "@/lib/photos/looks";
import type { PhotoReview } from "@/lib/photos/types";

// The AI comparison of an edit with the original. It points at things to check; it never vouches for the photo.
export function ReviewFlags({ review, preview, checking }: { review: PhotoReview | null; preview: boolean; checking: boolean }) {
  if (preview) {
    return <p className="text-rule">This is a development preview, so there’s nothing to compare: it’s your original photo, unchanged.</p>;
  }
  if (!review) {
    return <p className="text-rule">{checking ? "AI is comparing this version with your original…" : "This version wasn’t compared with your original. Look closely yourself."}</p>;
  }
  if (review.method !== "ai") {
    return (
      <p className="text-rule">
        {review.method === "failed"
          ? "AI couldn’t compare this version with your original this time. Look closely yourself before approving it."
          : "No AI service that can see photos is connected, so compare the two photos yourself."}
      </p>
    );
  }
  if (review.flags.length === 0) {
    return (
      <p className="flex flex-wrap items-start gap-2.5 text-rule">
        <ActorChip actor="ai" />
        <span className="min-w-0 flex-1">AI didn’t spot changes to the product. AI can miss things, so compare the photos yourself too.</span>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-check-tint px-4 py-3 text-check">
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        <ActorChip actor="ai" /> Look closely at {review.flags.length === 1 ? "this" : "these"} before approving
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px]">
        {review.flags.map((flag) => (
          <li key={`${flag.kind}:${flag.detail}`}>
            <strong>{FLAG_LABELS[flag.kind]}:</strong> {flag.detail}
          </li>
        ))}
      </ul>
      <p className="text-[15px]">If the product doesn’t look right, ask for a change or make another version.</p>
    </div>
  );
}
