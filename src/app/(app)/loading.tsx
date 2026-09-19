import { Skeleton } from "@/components/ui/skeleton";

export default function AppSectionLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
