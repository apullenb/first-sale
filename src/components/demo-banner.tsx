import { getCurrentUser } from "@/lib/auth/server";
import { DemoGuard } from "./demo-mode";
import { StartOwnButton } from "./start-own-button";

// Every page of a demo session says so, with the way out to a real account
export async function DemoBanner() {
  const user = await getCurrentUser();
  if (!user.demo) return null;
  return (
    <div role="note" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-accent-ring bg-accent-tint px-4 py-2 text-[15px] text-accent-ink">
      <p>
        You’re exploring the SnapStart demo business. Look around — changes aren’t saved.
      </p>
      <StartOwnButton />
      <DemoGuard />
    </div>
  );
}
