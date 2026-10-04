import { initialsFromName } from "@/lib/brand";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
} as const;

export function MessageAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-green/15 font-bold text-brand-green dark:bg-brand-green/25",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {initialsFromName(name)}
    </div>
  );
}
