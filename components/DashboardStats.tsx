import type { DashboardStats as DashboardStatsData } from "@/lib/stats";

const statItems = [
  { key: "newItems24h", label: "24시간 신규" },
  { key: "officialItems24h", label: "공식자료" },
  { key: "newsItems24h", label: "뉴스" },
  { key: "totalItems", label: "전체 보관" }
] as const;

export function DashboardStats({ stats }: { stats: DashboardStatsData }) {
  return (
    <section aria-label="수집 현황" className="border-b border-rule bg-canvas">
      <dl className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-4">
        {statItems.map((item) => {
          return (
            <div
              className="flex min-w-0 items-baseline justify-between gap-3 border-b border-line px-3 py-3 min-[360px]:odd:border-r md:border-b-0 md:border-r md:px-4 md:last:border-r-0"
              key={item.key}
            >
              <dt className="min-w-0 text-[11px] font-black text-ink-soft">{item.label}</dt>
              <dd className="metric-tabular shrink-0 text-base font-black leading-none text-ink sm:text-lg">
                {stats[item.key]}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
