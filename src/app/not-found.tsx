import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { HOSPITAL_NAME } from "@/lib/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="mb-6 flex items-center justify-center rounded-full bg-muted p-4">
        <Image
          src="/brand/logo-mark.png"
          alt={HOSPITAL_NAME}
          width={64}
          height={64}
          className="rounded"
        />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
        404 — Page Not Found
      </h1>
      <p className="mt-3 text-base text-muted-foreground max-w-md">
        The page or form record you are looking for does not exist, has been moved, or the link has expired.
      </p>
      <div className="mt-8 flex gap-4">
        <Button asChild variant="default">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
