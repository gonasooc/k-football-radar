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
      <div className="px-1 py-2 sm:py-4">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-accent">
          레이더 인덱스
        </p>
      </div>
      <div className="grid grid-cols-2 border-t border-line lg:grid-cols-4">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              className="border-b border-line px-3 py-3 odd:border-r sm:px-5 sm:py-5 lg:border-b-0 lg:border-r lg:px-6 lg:last:border-r-0"
              key={item.key}
            >
              <div className="flex items-center gap-2 sm:gap-2.5">
                <Icon aria-hidden="true" className="size-3.5 shrink-0 text-accent sm:size-4" />
                <p className="text-[11px] font-black text-ink-soft sm:text-xs">{item.label}</p>
              </div>
              <p className="metric-tabular mt-2 text-2xl font-black leading-none text-ink sm:mt-3 sm:text-3xl">
                {stats[item.key]}
              </p>
              <p className="mt-2 hidden text-xs font-semibold text-muted sm:block">
                {item.key === "totalItems" ? "보관 중인 전체 항목" : "최근 24시간 기준"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
