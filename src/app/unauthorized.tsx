import Link from "next/link";
import { LogIn } from "lucide-react";

export default function Unauthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="mb-6 flex items-center justify-center rounded-full bg-muted p-4">
        <LogIn className="h-10 w-10 text-muted-foreground" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
        401 — Sign In Required
      </h1>
      <p className="mt-3 max-w-md text-base text-muted-foreground">
        Please sign in to view this page.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/sign-in"
          className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
