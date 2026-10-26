import { createAuthClient } from "better-auth/react";

// Same-origin client for the sign-up, log-in and log-out buttons
export const authClient = createAuthClient();
