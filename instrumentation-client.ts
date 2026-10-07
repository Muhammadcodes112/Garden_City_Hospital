import * as Sentry from "@sentry/nextjs";
import { scrubBreadcrumb, scrubEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend: (event) => scrubEvent(event as unknown as Record<string, unknown>) as never,
  beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb as unknown as Record<string, unknown>) as never,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
