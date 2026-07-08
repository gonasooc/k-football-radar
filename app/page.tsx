import Link from "next/link";
import { ArrowRight, RadioTower } from "lucide-react";

import { DashboardStats } from "@/components/DashboardStats";
import { ItemCard } from "@/components/ItemCard";
import { SectionHeader } from "@/components/SectionHeader";
import { getDataBundle } from "@/lib/data";
import { getDashboardStats } from "@/lib/stats";

export default function DashboardPage() {
  const data = getDataBundle();
  const stats = getDashboardStats({
    items: data.items,
    issues: data.issues,
    people: data.people,
    collectionState: data.collectionState
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SectionHeader
        action={
          <Link
            className="focus-ring motion-soft inline-flex min-h-11 items-center gap-2 rounded-control bg-accent px-4 py-2 text-sm font-bold text-canvas hover:bg-ink"
            href="/feed"
          >
            전체 피드
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        }
        description="최근 24시간의 신규 자료, 공식자료 비중, 많이 언급된 이슈와 인물을 압축해서 보여줍니다."
        eyebrow="Today"
        title="오늘의 대시보드"
      />

      <div className="mt-8">
        <DashboardStats stats={stats} />
      </div>

      <section className="mt-8 grid gap-0 overflow-hidden rounded-panel border border-line bg-panel shadow-panel lg:grid-cols-2">
        <div className="border-b border-line p-5 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-ink">이슈 움직임</h2>
            <RadioTower aria-hidden="true" className="size-5 text-accent" />
          </div>
          <div className="space-y-2">
            {stats.topIssues.map((issue) => (
              <Link
                className="focus-ring motion-soft grid grid-cols-[1fr_auto] items-center gap-3 rounded-control border border-line bg-panel px-4 py-3 text-sm font-bold text-ink hover:border-accent-soft hover:bg-blush"
                href={`/issues/${issue.id}`}
                key={issue.id}
              >
                <span>{issue.name}</span>
                <span className="metric-tabular text-accent">{issue.count}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-ink">인물 언급</h2>
            <span className="text-xs font-black uppercase tracking-[0.16em] text-accent">
              neutral log
            </span>
          </div>
          <div className="space-y-2">
            {stats.topPeople.map((person) => (
              <Link
                className="focus-ring motion-soft grid grid-cols-[1fr_auto] items-center gap-3 rounded-control border border-line bg-panel px-4 py-3 text-sm font-bold text-ink hover:border-accent-soft hover:bg-blush"
                href={`/people/${person.id}`}
                key={person.id}
              >
                <span>{person.name}</span>
                <span className="metric-tabular text-accent">{person.count}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <div className="flex items-end justify-between gap-3 border-b border-line pb-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">
              latest desk
            </p>
            <h2 className="mt-1 text-xl font-black text-ink">최신 수집 항목</h2>
          </div>
          <p className="hidden max-w-md text-right text-sm font-medium leading-6 text-muted sm:block">
            자동 태그는 키워드 기반입니다. 판단은 각 카드의 원문 링크에서 확인합니다.
          </p>
        </div>
        <div className="space-y-3">
          {stats.latestItems.map((item) => (
            <ItemCard item={item} issues={data.issues} key={item.id} people={data.people} />
          ))}
        </div>
      </section>
    </div>
  );
}
