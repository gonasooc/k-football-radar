import { FeedResultsSkeleton, SkeletonBlock } from "@/components/LoadingSkeletons";

const STAT_SKELETONS = [0, 1, 2, 3] as const;

export default function Loading() {
  return (
    <div
      aria-live="polite"
      className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8 lg:px-8"
      role="status"
    >
      <span className="sr-only">자료를 불러오는 중입니다.</span>

      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="flex justify-end border-b border-rule pb-3">
          <SkeletonBlock className="h-3 w-40" />
        </div>

        <section className="border-b border-rule bg-canvas">
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-4">
            {STAT_SKELETONS.map((item) => (
              <div
                className="flex min-w-0 items-center justify-between gap-3 border-b border-line px-3 py-3 min-[360px]:odd:border-r md:border-b-0 md:border-r md:px-4 md:last:border-r-0"
                key={item}
              >
                <SkeletonBlock className="h-3 w-16" />
                <SkeletonBlock className="h-5 w-10" />
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 border-y border-rule py-3">
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(260px,1fr)_260px_auto]">
            <SkeletonBlock className="h-11 w-full" control />
            <SkeletonBlock className="hidden h-11 w-full lg:block" control />
            <SkeletonBlock className="h-11 w-24" control />
          </div>
        </div>

        <div className="mt-5 flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-11 w-36" control />
        </div>

        <div className="mt-5">
          <FeedResultsSkeleton animated={false} />
        </div>
      </div>
    </div>
  );
}
