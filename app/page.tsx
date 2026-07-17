import { DashboardStats } from "@/components/DashboardStats";
import { FeedClient } from "@/components/FeedClient";
import { getDataBundle } from "@/lib/data";
import { formatDateTime } from "@/lib/date";
import { getFeedPage } from "@/lib/feed-page";
import { getFeedContentRevision } from "@/lib/feed-snapshot";
import { getFeedFiltersFromSearchParams, toFeedItems } from "@/lib/filter";
import { getDashboardStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const data = await getDataBundle();
  const stats = getDashboardStats({
    items: data.items,
    collectionState: data.collectionState
  });
  const initialFilters = getFeedFiltersFromSearchParams(await searchParams, {
    issueIds: new Set(data.issues.map((issue) => issue.id)),
    personIds: new Set(data.people.map((person) => person.id))
  });
  const initialPage = getFeedPage(toFeedItems(data.items), initialFilters, {
    snapshot: getFeedContentRevision(data.items, data.storyClusters),
    storyClusters: data.storyClusters
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <div className="flex justify-end border-b border-rule pb-3">
        <h1 className="sr-only">한국축구 이슈 뉴스와 공식자료</h1>
        <time
          className="metric-tabular text-xs font-bold text-muted"
          dateTime={stats.lastCollectedAt}
        >
          업데이트 {formatDateTime(stats.lastCollectedAt)}
        </time>
      </div>

      <div>
        <DashboardStats stats={stats} />
      </div>

      <div className="mt-6">
        <FeedClient
          initialFilters={initialFilters}
          initialPage={initialPage}
          issues={data.issues}
          people={data.people}
        />
      </div>
    </div>
  );
}
