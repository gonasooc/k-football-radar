import { DashboardStats } from "@/components/DashboardStats";
import { FeedClient } from "@/components/FeedClient";
import { getDataBundle } from "@/lib/data";
import { formatDateTime } from "@/lib/date";
import { getDashboardStats } from "@/lib/stats";

export default function DashboardPage() {
  const data = getDataBundle();
  const stats = getDashboardStats({
    items: data.items,
    collectionState: data.collectionState
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-5 sm:px-6 sm:pt-7 lg:px-8">
      <div className="flex justify-end border-rule text-xs font-bold text-muted">
        <span>업데이트 {formatDateTime(stats.lastCollectedAt)}</span>
      </div>

      <div className="mt-3">
        <DashboardStats stats={stats} />
      </div>

      <div className="mt-5">
        <FeedClient items={data.items} issues={data.issues} people={data.people} />
      </div>
    </div>
  );
}
