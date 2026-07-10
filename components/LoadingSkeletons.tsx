const FEATURED_SKELETONS = [0, 1, 2] as const;
const LIST_SKELETONS = [0, 1] as const;

export function SkeletonBlock({
  className,
  control = false
}: {
  className: string;
  control?: boolean;
}) {
  return (
    <div className={`${control ? "rounded-control" : "rounded-chip"} bg-line ${className}`} />
  );
}

function ArticleSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <article
      className={
        compact
          ? "h-full border-t border-line px-2 py-5 first:border-t-rule sm:px-3 lg:border-t-rule lg:px-5"
          : "border-t border-line px-2 py-5 sm:px-3"
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-6 w-9" />
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-4 w-16" />
        </div>

        <div className={compact ? "mt-3 space-y-2" : "mt-2 space-y-2"}>
          <SkeletonBlock className="h-6 w-full" />
          <SkeletonBlock className="h-6 w-4/5" />
        </div>

        <div className={compact ? "mt-3 space-y-2" : "mt-2 space-y-2"}>
          <SkeletonBlock className="h-5 w-full" />
          <SkeletonBlock className="h-5 w-3/4" />
        </div>

        <div className={compact ? "mt-auto flex gap-1.5 pt-4" : "mt-3 flex gap-1.5"}>
          <SkeletonBlock className="h-11 w-20" />
          <SkeletonBlock className="h-11 w-24" />
        </div>
      </div>
    </article>
  );
}

export function FeedResultsSkeleton({ animated = true }: { animated?: boolean }) {
  return (
    <div
      aria-hidden="true"
      data-feed-results-skeleton="true"
      className={`${animated ? "motion-safe:animate-pulse " : ""}space-y-6`}
    >
      <div className="grid border-b border-rule lg:grid-cols-3 lg:divide-x lg:divide-line">
        {FEATURED_SKELETONS.map((item) => (
          <ArticleSkeleton compact key={item} />
        ))}
      </div>

      <div className="border-b border-rule">
        {LIST_SKELETONS.map((item) => (
          <ArticleSkeleton key={item} />
        ))}
      </div>
    </div>
  );
}
