import { Archive, Clock3, FileText, Newspaper } from "lucide-react";

import { formatDateTime } from "@/lib/date";
import type { DashboardStats as DashboardStatsData } from "@/lib/stats";

const statItems = [
  { key: "newItems24h", label: "최근 24시간 신규", icon: Clock3 },
  { key: "officialItems24h", label: "공식자료", icon: FileText },
  { key: "newsItems24h", label: "뉴스", icon: Newspaper },
  { key: "totalItems", label: "전체 보관", icon: Archive }
] as const;

export function DashboardStats({ stats }: { stats: DashboardStatsData }) {
  return (
    <section className="overflow-hidden rounded-panel border border-line bg-panel shadow-panel">
      <div className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-accent">
            dashboard brief
          </p>
          <h2 className="mt-1 text-lg font-black text-ink">수집 현황</h2>
        </div>
        <p className="text-xs font-bold text-muted">
          마지막 수집 {formatDateTime(stats.lastCollectedAt)}
        </p>
      </div>
      <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <div className="p-5" key={item.key}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-ink-soft">{item.label}</p>
                <Icon aria-hidden="true" className="size-4 text-accent" />
              </div>
              <p className="metric-tabular mt-4 text-3xl font-black leading-none text-ink">
                {stats[item.key]}
              </p>
              <p className="mt-2 text-xs font-semibold text-muted">
                {item.key === "totalItems" ? "보관 중인 전체 항목" : "최근 24시간 기준"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
