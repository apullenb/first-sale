import Link from "next/link";
import { PAGE_TITLE, PRIMARY_LINK } from "@/components/styles";

export default function AppNotFound() {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h1 className={PAGE_TITLE}>Page not found</h1>
      <p className="text-lg text-muted">This page doesn’t exist, or it may have been removed.</p>
      <Link href="/" className={PRIMARY_LINK}>
        Go to Today
      </Link>
    </div>
  );
}
