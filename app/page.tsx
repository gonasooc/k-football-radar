import { DashboardStats } from "@/components/DashboardStats";
import { FeedClient } from "@/components/FeedClient";
import { getDataBundle } from "@/lib/data";
import { formatDateTime } from "@/lib/date";
import { toFeedItems } from "@/lib/filter";
import { getDashboardStats } from "@/lib/stats";

export default function DashboardPage() {
  const data = getDataBundle();
  const stats = getDashboardStats({
    items: data.items,
    collectionState: data.collectionState
  });
  const feedItems = toFeedItems(data.items);

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
          items={feedItems}
          issues={data.issues}
          people={data.people}
        />
      </div>
    </div>
  );
}
