// Shown wherever results came from built-in stand-ins instead of the AI service, so practice output is never taken as real
export function PracticeBanner({ what }: { what: string }) {
  return (
    <p className="rounded-xl border border-check/30 bg-check-tint px-4 py-3 text-[15px] text-check">
      <strong>Practice mode.</strong> {what} No AI service is connected, so SnapStart made simple stand-ins from your answers. Don’t rely on
      this as real research or advice.
    </p>
  );
}
