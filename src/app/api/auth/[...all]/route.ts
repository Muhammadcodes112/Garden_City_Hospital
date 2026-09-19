import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const { GET, POST: authPost } = toNextJsHandler(auth);

// This is an admin-only, invite-free application: there is no sign-up flow
// anywhere in the UI, and none is permitted at the API layer either — admin
// accounts are created exclusively via `npm run create-admin`, which talks
// to Better Auth's internal API directly rather than over HTTP. Block the
// public sign-up endpoint here so it can't be hit directly.
async function POST(req: Request) {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/sign-up/email")) {
    return new Response("Not found", { status: 404 });
  }
  return authPost(req);
}

export { GET, POST };
