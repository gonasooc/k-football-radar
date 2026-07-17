import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PaginatedItemList } from "@/components/PaginatedItemList";
import { SectionHeader } from "@/components/SectionHeader";
import { getDataBundle } from "@/lib/data";
import { toFeedItems } from "@/lib/filter";
import { getFeedContentRevision } from "@/lib/feed-snapshot";
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
    getFeedContentRevision(data.items, data.storyClusters),
    data.storyClusters
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
        <PaginatedItemList
          emptyDescription="새 자료가 수집되면 이 이슈 화면에 자동으로 표시됩니다."
          emptyTitle="아직 이 이슈와 연결된 자료가 없습니다."
          fixedFilters={fixedFilters}
          heading="관련 수집 항목"
          headingId="issue-items-title"
          initialPage={initialPage}
          issues={data.issues}
          key={issue.id}
          people={data.people}
        />
      </section>
    </div>
  );
}
