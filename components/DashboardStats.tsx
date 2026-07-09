import { Archive, Clock3, FileText, Newspaper } from "lucide-react";

import type { DashboardStats as DashboardStatsData } from "@/lib/stats";

const statItems = [
  { key: "newItems24h", label: "최근 24시간 신규", icon: Clock3 },
  { key: "officialItems24h", label: "공식자료", icon: FileText },
  { key: "newsItems24h", label: "뉴스", icon: Newspaper },
  { key: "totalItems", label: "전체 보관", icon: Archive }
] as const;

export function DashboardStats({ stats }: { stats: DashboardStatsData }) {
  return (
    <section className="border-y border-rule bg-canvas">
      <dl className="grid grid-cols-2 lg:grid-cols-4">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 odd:border-r sm:px-4 lg:border-b-0 lg:border-r lg:px-5 lg:last:border-r-0"
              key={item.key}
            >
              <dt className="flex min-w-0 items-center gap-1.5 text-[11px] font-black text-ink-soft">
                <Icon aria-hidden="true" className="size-3 shrink-0 text-muted" />
                <span className="truncate">{item.label}</span>
              </dt>
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
