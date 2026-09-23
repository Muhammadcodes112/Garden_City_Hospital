import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        draft: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:border-amber-400/30 dark:bg-amber-400/10",
        completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 dark:border-emerald-400/30 dark:bg-emerald-400/10",
        default: "border-border bg-muted text-foreground",
        secondary: "border-border bg-muted text-foreground",
        destructive: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
