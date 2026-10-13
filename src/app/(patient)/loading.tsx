export default function PatientLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-muted rounded-xl" />
        <div className="h-4 w-96 max-w-full bg-muted/60 rounded-lg" />
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-48 rounded-2xl border border-border/60 bg-card/60 p-6 space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-muted" />
          <div className="h-5 w-40 bg-muted rounded-lg" />
          <div className="h-3 w-56 bg-muted/60 rounded" />
          <div className="h-9 w-full bg-muted rounded-xl mt-4" />
        </div>

        <div className="h-48 rounded-2xl border border-border/60 bg-card/60 p-6 space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-muted" />
          <div className="h-5 w-40 bg-muted rounded-lg" />
          <div className="h-3 w-56 bg-muted/60 rounded" />
          <div className="h-9 w-full bg-muted rounded-xl mt-4" />
        </div>
      </div>

      {/* Hospital info banner skeleton */}
      <div className="h-20 rounded-2xl border border-border/40 bg-muted/20" />
    </div>
  );
}
