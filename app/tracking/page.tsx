import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SectionHeader } from "@/components/SectionHeader";
import { getDataBundle } from "@/lib/data";
import { getTrackingTabFromSearchParams, trackingTabs } from "@/lib/navigation";

type TrackingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function tabClassName(active: boolean): string {
  return `focus-ring motion-soft inline-flex min-h-11 items-center justify-center rounded-control border px-4 py-2 text-sm font-black ${
    active
      ? "border-accent bg-accent text-canvas"
      : "border-rule bg-panel text-ink-soft hover:border-accent-soft hover:bg-blush hover:text-accent"
  }`;
}

export default async function TrackingPage({ searchParams }: TrackingPageProps) {
  const data = getDataBundle();
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
          <div
            aria-label="트래킹 보기"
            className="inline-grid grid-cols-2 gap-1 rounded-panel border border-line bg-paper p-1"
            role="tablist"
          >
            {trackingTabs.map((tab) => {
              const active = activeTab === tab.id;

              return (
                <Link
                  aria-selected={active}
                  className={tabClassName(active)}
                  href={tab.href}
                  key={tab.id}
                  role="tab"
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        }
        description="이슈와 인물 중심으로 관련 기사와 공식자료를 확인합니다."
        title="트래킹"
      />

      {activeTab === "issues" ? (
        <section className="mt-8 overflow-hidden border-y border-rule bg-panel">
          <div className="grid grid-cols-[64px_1fr_auto] border-b border-line bg-paper px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-muted">
            <span>순위</span>
            <span>이슈</span>
            <span>항목</span>
          </div>
          <div className="divide-y divide-line">
            {data.issues.map((issue, index) => (
              <Link
                className="focus-ring motion-soft grid grid-cols-[48px_1fr_auto] items-center gap-4 px-2 py-5 text-ink hover:bg-blush sm:grid-cols-[64px_1fr_auto] sm:px-4"
                href={`/issues/${issue.id}`}
                key={issue.id}
              >
                <span className="metric-tabular text-xl font-black text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block text-base font-black">{issue.name}</span>
                  <span className="mt-1 block max-w-3xl text-sm font-medium leading-6 text-ink-soft">
                    {issue.description}
                  </span>
                </span>
                <span className="inline-flex items-center gap-3">
                  <span className="metric-tabular text-2xl font-black text-ink">
                    {issueCounts.get(issue.id) ?? 0}
                  </span>
                  <ArrowRight aria-hidden="true" className="hidden size-4 text-accent sm:block" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-8 overflow-hidden border-y border-rule bg-panel">
          <div className="grid grid-cols-[1fr_auto] border-b border-line bg-paper px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-muted md:grid-cols-[1fr_1fr_auto]">
            <span>인물</span>
            <span className="hidden md:block">키워드</span>
            <span>언급</span>
          </div>
          <div className="divide-y divide-line">
            {data.people
              .filter((person) => person.published)
              .map((person) => (
                <Link
                  className="focus-ring motion-soft grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-4 text-ink hover:bg-blush md:grid-cols-[1fr_1fr_auto]"
                  href={`/people/${person.id}`}
                  key={person.id}
                >
                  <span>
                    <span className="block text-base font-black">{person.name}</span>
                    <span className="mt-1 block text-sm font-medium leading-6 text-ink-soft">
                      {person.role}
                    </span>
                  </span>
                  <span className="hidden text-xs font-medium leading-5 text-muted md:block">
                    {person.keywords.join(", ")}
                  </span>
                  <span className="inline-flex items-center gap-3">
                    <span className="metric-tabular text-xl font-black text-accent">
                      {personCounts.get(person.id) ?? 0}
                    </span>
                    <ArrowRight aria-hidden="true" className="hidden size-4 text-accent sm:block" />
                  </span>
                </Link>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
