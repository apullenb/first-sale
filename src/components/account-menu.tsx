import { getCurrentUser } from "@/lib/auth/server";
import { LogOutButton } from "./log-out-button";

// Also the app's session check: an invalid or expired session redirects to log in
export async function AccountMenu() {
  const user = await getCurrentUser();

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-48 truncate text-sm text-muted sm:inline">{user.name}</span>
      <LogOutButton />
    </div>
  );
}
