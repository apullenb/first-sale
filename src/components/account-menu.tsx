import { getCurrentUser } from "@/lib/auth/server";
import { LogOutButton } from "./log-out-button";

// Also the app's session check: an invalid or expired session redirects to log in
export async function AccountMenu() {
  const user = await getCurrentUser();

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-sm text-white/60">{user.name}</span>
      <LogOutButton />
    </div>
  );
}
