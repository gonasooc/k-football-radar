import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/EmptyState";
import { PaginatedItemList } from "@/components/PaginatedItemList";
import { SectionHeader } from "@/components/SectionHeader";
import { getDataBundle } from "@/lib/data";
import { toFeedItems } from "@/lib/filter";
import { getInitialScopedFeedPage } from "@/lib/scoped-feed-page";

type IssueDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: IssueDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getDataBundle();
  const issue = data.issues.find((candidate) => candidate.id === id);

  if (!issue) {
    return { title: "이슈를 찾을 수 없음" };
  }

  return {
    title: issue.name,
    description: issue.description
  };
}

export default async function IssueDetailPage({ params }: IssueDetailPageProps) {
  const { id } = await params;
  const data = await getDataBundle();
  const issue = data.issues.find((candidate) => candidate.id === id);

  if (!issue) {
    notFound();
  }

  const { fixedFilters, initialPage } = getInitialScopedFeedPage(
    toFeedItems(data.items),
    { issueId: issue.id },
    data.collectionState.lastCollectedAt
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SectionHeader description={issue.description} title={issue.name} />
      <dl className="mt-5 border-y border-rule">
        <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-xs font-black tracking-[0.12em] text-ink-soft">감지 키워드</dt>
          <dd className="text-sm font-medium leading-6 text-ink">
            {issue.keywords.join(", ")}
          </dd>
        </div>
      </dl>
      <section aria-labelledby="issue-items-title" className="mt-7">
        <div className="flex items-center justify-between gap-4 pb-2">
          <h2 className="text-sm font-black text-ink" id="issue-items-title">
            관련 수집 항목
          </h2>
          <span className="metric-tabular text-xs font-bold text-ink-soft">
            {initialPage.total}건
          </span>
        </div>
        {initialPage.total > 0 ? (
          <PaginatedItemList
            fixedFilters={fixedFilters}
            initialPage={initialPage}
            issues={data.issues}
            key={issue.id}
            people={data.people}
          />
        ) : (
          <EmptyState
            description="새 자료가 수집되면 이 이슈 화면에 자동으로 표시됩니다."
            title="아직 이 이슈와 연결된 자료가 없습니다."
          />
        )}
      </section>
    </div>
  );
}
