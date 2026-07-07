import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
            className="focus-ring inline-flex items-center gap-2 border border-ink bg-ink px-4 py-3 text-sm font-black text-paper transition hover:bg-pine"
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

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.2fr]">
        <section className="space-y-4">
          <h2 className="text-xl font-black text-ink">많이 언급된 이슈</h2>
          <div className="space-y-2">
            {stats.topIssues.map((issue) => (
              <Link
                className="focus-ring flex items-center justify-between border border-line bg-white/82 px-4 py-3 text-sm font-bold text-ink transition hover:border-brass"
                href={`/issues/${issue.id}`}
                key={issue.id}
              >
                <span>{issue.name}</span>
                <span className="text-brass">{issue.count}</span>
              </Link>
            ))}
          </div>

          <h2 className="pt-4 text-xl font-black text-ink">많이 언급된 인물</h2>
          <div className="space-y-2">
            {stats.topPeople.map((person) => (
              <Link
                className="focus-ring flex items-center justify-between border border-line bg-white/82 px-4 py-3 text-sm font-bold text-ink transition hover:border-signal"
                href={`/people/${person.id}`}
                key={person.id}
              >
                <span>{person.name}</span>
                <span className="text-signal">{person.count}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black text-ink">최신 수집 항목</h2>
          <div className="space-y-3">
            {stats.latestItems.map((item) => (
              <ItemCard item={item} issues={data.issues} key={item.id} people={data.people} />
            ))}
          </div>
        </section>
      </div>

      <p className="mt-8 border-l-4 border-pine bg-white/72 px-4 py-3 text-sm font-semibold leading-6 text-ink/65">
        자동 태그는 제목과 짧은 설명의 키워드 기반 분류입니다. 원문 판단은 각 카드의 원문 링크에서 확인합니다.
      </p>
    </div>
  );
}
