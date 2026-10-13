import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Returns the current session, or null if the request is unauthenticated.
 * Wrapped in React cache() so concurrent layout/page calls within a single
 * server render share the exact same lookup without redundant DB queries.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});
