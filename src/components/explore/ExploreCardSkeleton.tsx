export function ExploreCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm animate-pulse">
      {/* Preview area */}
      <div className="h-36 bg-muted" />

      {/* Info area */}
      <div className="px-4 pb-4 pt-3 space-y-3">
        <div className="h-5 bg-muted rounded w-3/4" />
        <div className="space-y-1.5">
          <div className="h-3.5 bg-muted rounded w-full" />
          <div className="h-3.5 bg-muted rounded w-2/3" />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <div className="w-6 h-6 rounded-full bg-muted" />
          <div className="h-3.5 bg-muted rounded w-24" />
        </div>
      </div>
    </div>
  )
}
