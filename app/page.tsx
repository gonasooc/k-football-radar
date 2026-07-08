import Link from "next/link";
import { ArrowRight, RadioTower } from "lucide-react";

import { DashboardStats } from "@/components/DashboardStats";
import { ItemCard } from "@/components/ItemCard";
import { getDataBundle } from "@/lib/data";
import { formatDateTime } from "@/lib/date";
import { getDashboardStats } from "@/lib/stats";

export default function DashboardPage() {
  const data = getDataBundle();
  const stats = getDashboardStats({
    items: data.items,
    issues: data.issues,
    people: data.people,
    collectionState: data.collectionState
  });
  const [leadItem, ...remainingItems] = stats.latestItems;
  const secondaryItems = remainingItems.slice(0, 4);
  const moreItems = remainingItems.slice(4, 10);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 border-b border-rule pb-3 text-xs font-bold text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>홈</span>
        <span>업데이트 {formatDateTime(stats.lastCollectedAt)}</span>
      </div>

      <div className="mt-4">
        <DashboardStats stats={stats} />
      </div>

      <section className="mt-6 grid gap-6 border-b border-rule pb-6 lg:grid-cols-[1.35fr_0.95fr_0.7fr]">
        <div className="lg:border-r lg:border-line lg:pr-6">
          {leadItem ? (
            <ItemCard item={leadItem} issues={data.issues} people={data.people} variant="lead" />
          ) : null}
        </div>

        <div className="grid gap-x-5 md:grid-cols-2 lg:block lg:space-y-0 lg:divide-y lg:divide-line">
          {secondaryItems.map((item) => (
            <ItemCard
              item={item}
              issues={data.issues}
              key={item.id}
              people={data.people}
              variant="compact"
            />
          ))}
        </div>

        <aside className="border-t border-rule pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl font-black text-ink">브리핑</h2>
            <RadioTower aria-hidden="true" className="size-5 text-accent" />
          </div>

          <div className="mt-5">
            <p className="border-b border-line pb-2 text-[11px] font-black uppercase tracking-[0.16em] text-accent">
              이슈
            </p>
            <div className="divide-y divide-line">
              {stats.topIssues.map((issue) => (
                <Link
                  className="focus-ring motion-soft grid min-h-11 grid-cols-[1fr_auto] items-center gap-3 py-3 text-sm font-black text-ink hover:text-accent"
                  href={`/issues/${issue.id}`}
                  key={issue.id}
                >
                  <span>{issue.name}</span>
                  <span className="metric-tabular text-muted">{issue.count}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="border-b border-line pb-2 text-[11px] font-black uppercase tracking-[0.16em] text-accent">
              인물
            </p>
            <div className="divide-y divide-line">
              {stats.topPeople.map((person) => (
                <Link
                  className="focus-ring motion-soft grid min-h-11 grid-cols-[1fr_auto] items-center gap-3 py-3 text-sm font-black text-ink hover:text-accent"
                  href={`/people/${person.id}`}
                  key={person.id}
                >
                  <span>{person.name}</span>
                  <span className="metric-tabular text-muted">{person.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between gap-3 border-b border-rule pb-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-accent">
              최신 큐
            </p>
            <h2 className="mt-1 font-serif text-2xl font-black text-ink">최신 수집 항목</h2>
          </div>
          <Link
            className="focus-ring motion-soft inline-flex min-h-11 items-center gap-2 rounded-control border border-rule bg-canvas px-3 py-2 text-sm font-black text-ink hover:border-accent-soft hover:bg-blush hover:text-accent"
            href="/feed"
          >
            전체 피드
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        <div className="grid gap-x-6 md:grid-cols-2 lg:grid-cols-3">
          {moreItems.map((item) => (
            <ItemCard
              item={item}
              issues={data.issues}
              key={item.id}
              people={data.people}
              variant="compact"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
