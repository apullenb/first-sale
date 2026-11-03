import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db/client";
import { isDemoToken } from "@/lib/demo";
import { createAuth, type Auth } from "./config";

let auth: Auth | undefined;

// Created on first request, so builds never open the local database
export function getAuth(): Auth {
  auth ??= createAuth(getDb());
  return auth;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  // Opened by /demo: read-only
  demo: boolean;
}

// Checks the session against the database; signed-out visitors go to log in
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  // Read the request first: during prerendering this suspends before the database opens
  const requestHeaders = await headers();
  // Server Components can't set cookies, so renewal is left to the client's get-session call
  const session = await getAuth().api.getSession({ headers: requestHeaders, query: { disableRefresh: true } });
  if (!session) redirect("/login");
  return { id: session.user.id, name: session.user.name, email: session.user.email, demo: isDemoToken(session.session.token) };
});

// Server actions start with this, so the demo gets a note instead of an error page
export async function isDemoSession(): Promise<boolean> {
  return (await getCurrentUser()).demo;
}
