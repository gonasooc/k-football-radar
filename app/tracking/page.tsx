import type { Metadata } from "next";
import Link from "next/link";

import { SectionHeader } from "@/components/SectionHeader";
import { getDataBundle } from "@/lib/data";
import { getTrackingTabFromSearchParams, trackingTabs } from "@/lib/navigation";

export const metadata: Metadata = {
  title: "트래킹",
  description: "한국축구 거버넌스 이슈와 인물별 뉴스·공식자료·유튜브 영상을 확인합니다."
};

export const dynamic = "force-dynamic";

type TrackingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function viewLinkClassName(active: boolean): string {
  return `focus-ring motion-soft inline-flex min-h-11 items-center justify-center border-b-2 px-3 text-sm font-black ${
    active
      ? "border-accent text-ink"
      : "border-transparent text-muted hover:border-rule hover:text-ink"
  }`;
}

export default async function TrackingPage({ searchParams }: TrackingPageProps) {
  const data = await getDataBundle();
  const activeTab = getTrackingTabFromSearchParams(await searchParams);
  const issueCounts = new Map<string, number>();
  const personCounts = new Map<string, number>();

  for (const item of data.items) {
    for (const issueId of item.issueTags) {
      issueCounts.set(issueId, (issueCounts.get(issueId) ?? 0) + 1);
    }
    for (const personId of item.personTags) {
      personCounts.set(personId, (personCounts.get(personId) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SectionHeader
        action={
          <nav aria-label="트래킹 보기" className="inline-flex border-b border-rule">
            {trackingTabs.map((tab) => {
              const active = activeTab === tab.id;

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={viewLinkClassName(active)}
                  href={tab.href}
                  key={tab.id}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        }
        description="이슈와 인물 중심으로 관련 뉴스·공식자료·유튜브 영상을 확인합니다."
        title="트래킹"
      />

      {activeTab === "issues" ? (
        <section aria-label="추적 이슈 목록" className="mt-7 border-y border-rule">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-line bg-paper px-4 py-3 text-xs font-black tracking-[0.12em] text-ink-soft">
            <span>이슈</span>
            <span>항목</span>
          </div>
          <ul className="divide-y divide-line">
            {data.issues.map((issue) => (
              <li key={issue.id}>
                <Link
                  className="focus-ring motion-soft grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 text-ink hover:bg-blush"
                  href={`/issues/${issue.id}`}
                >
                  <span className="min-w-0">
                    <span className="block text-base font-black">{issue.name}</span>
                    <span className="mt-1 block max-w-3xl text-sm font-medium leading-6 text-ink-soft">
                      {issue.description}
                    </span>
                  </span>
                  <span className="metric-tabular text-sm font-bold text-ink-soft">
                    {issueCounts.get(issue.id) ?? 0}건
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section aria-label="추적 인물 목록" className="mt-7 border-y border-rule">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-line bg-paper px-4 py-3 text-xs font-black tracking-[0.12em] text-ink-soft md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <span>인물</span>
            <span className="hidden md:block">키워드</span>
            <span>언급</span>
          </div>
          <ul className="divide-y divide-line">
            {data.people
              .filter((person) => person.published)
              .map((person) => (
                <li key={person.id}>
                  <Link
                    className="focus-ring motion-soft grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 text-ink hover:bg-blush md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                    href={`/people/${person.id}`}
                  >
                    <span className="min-w-0">
                      <span className="block text-base font-black">{person.name}</span>
                      <span className="mt-1 block text-sm font-medium leading-6 text-ink-soft">
                        {person.role}
                      </span>
                    </span>
                    <span className="hidden min-w-0 text-xs font-medium leading-5 text-ink-soft md:block">
                      {person.keywords.join(", ")}
                    </span>
                    <span className="metric-tabular text-sm font-bold text-ink-soft">
                      {personCounts.get(person.id) ?? 0}건
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
