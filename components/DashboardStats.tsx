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
      <div className="px-1 py-4">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-accent">
          레이더 인덱스
        </p>
      </div>
      <div className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-4">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              className="border-b border-line px-4 py-5 sm:px-5 sm:odd:border-r lg:border-b-0 lg:border-r lg:px-6 lg:last:border-r-0"
              key={item.key}
            >
              <div className="flex items-center gap-2.5">
                <Icon aria-hidden="true" className="size-4 shrink-0 text-accent" />
                <p className="text-xs font-black text-ink-soft">{item.label}</p>
              </div>
              <p className="metric-tabular mt-3 text-3xl font-black leading-none text-ink">
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
