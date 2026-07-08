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
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 border-b border-rule pb-3 text-xs font-bold text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>홈</span>
        <span>업데이트 {formatDateTime(stats.lastCollectedAt)}</span>
      </div>

      <div className="mt-4">
        <DashboardStats stats={stats} />
      </div>

      <section className="mt-6">
        <div className="flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-accent">
              기사 탐색
            </p>
            <h1 className="mt-1 text-3xl font-black text-ink sm:text-4xl">최신 기사</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-black text-muted sm:justify-end">
            <span className="border-y border-line px-2 py-1">전체 {data.items.length}개</span>
            <span className="border-y border-line px-2 py-1">게시 시각 최신순</span>
          </div>
        </div>

        <div className="mt-5">
          <FeedClient items={data.items} issues={data.issues} people={data.people} />
        </div>
      </section>
    </div>
  );
}
