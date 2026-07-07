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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {statItems.map((item) => {
        const Icon = item.icon;
        return (
          <div className="border border-line bg-white/82 p-4 shadow-sm" key={item.key}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-ink/58">{item.label}</p>
              <Icon aria-hidden="true" className="size-5 text-pine" />
            </div>
            <p className="mt-4 text-4xl font-black text-ink">{stats[item.key]}</p>
          </div>
        );
      })}
      <div className="border border-pine/25 bg-pine/10 p-4 sm:col-span-2 lg:col-span-4">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-pine">Last Collected</p>
        <p className="mt-2 text-xl font-black text-ink">{formatDateTime(stats.lastCollectedAt)}</p>
      </div>
    </div>
  );
}
