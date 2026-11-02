import { TEXT_LINK } from "@/components/styles";
import { demoOwnerEmail } from "@/lib/demo";

// Shown only when a demo account is set; a plain link, since /demo answers with a full page load
export function TryDemoLink() {
  if (!demoOwnerEmail()) return null;
  return (
    <p className="text-[15px] text-muted">
      Just looking?{" "}
      <a href="/demo" className={`inline-flex min-h-11 items-center ${TEXT_LINK}`}>
        Try the demo
      </a>
    </p>
  );
}
