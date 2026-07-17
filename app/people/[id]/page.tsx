import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PaginatedItemList } from "@/components/PaginatedItemList";
import { SectionHeader } from "@/components/SectionHeader";
import { getDataBundle } from "@/lib/data";
import { toFeedItems } from "@/lib/filter";
import { getFeedContentRevision } from "@/lib/feed-snapshot";
import { getInitialScopedFeedPage } from "@/lib/scoped-feed-page";

type PersonDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PersonDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getDataBundle();
  const person = data.people.find((candidate) => candidate.id === id);

  if (!person || !person.published) {
    return { title: "인물을 찾을 수 없음" };
  }

  return {
    title: person.name,
    description: `${person.name} (${person.role}) 관련 한국축구 뉴스·공식자료·유튜브 영상을 확인합니다.`
  };
}

export default async function PersonDetailPage({ params }: PersonDetailPageProps) {
  const { id } = await params;
  const data = await getDataBundle();
  const person = data.people.find((candidate) => candidate.id === id);

  if (!person || !person.published) {
    notFound();
  }

  const items = data.items.filter((item) => item.personTags.includes(person.id));
  const relatedIssues = data.issues.filter((issue) =>
    items.some((item) => item.issueTags.includes(issue.id))
  );
  const { fixedFilters, initialPage } = getInitialScopedFeedPage(
    toFeedItems(data.items),
    { personId: person.id },
    getFeedContentRevision(data.items, data.storyClusters),
    data.storyClusters
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SectionHeader description={person.role} title={person.name} />
      <dl className="mt-5 divide-y divide-line border-y border-rule">
        <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-xs font-black tracking-[0.12em] text-ink-soft">별칭</dt>
          <dd className="text-sm font-medium leading-6 text-ink">
            {[person.name, ...person.aliases].join(", ")}
          </dd>
        </div>
        <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-xs font-black tracking-[0.12em] text-ink-soft">검색 키워드</dt>
          <dd className="text-sm font-medium leading-6 text-ink">
            {person.keywords.join(", ")}
          </dd>
        </div>
        <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-xs font-black tracking-[0.12em] text-ink-soft">관련 이슈</dt>
          <dd className="text-sm font-medium leading-6 text-ink">
            {relatedIssues.map((issue) => issue.name).join(", ") || "없음"}
          </dd>
        </div>
      </dl>
      <section aria-labelledby="person-items-title" className="mt-7">
        <PaginatedItemList
          emptyDescription="새 자료에서 이 인물이 감지되면 이 화면에 자동으로 표시됩니다."
          emptyTitle="아직 이 인물과 연결된 자료가 없습니다."
          fixedFilters={fixedFilters}
          heading="관련 수집 항목"
          headingId="person-items-title"
          initialPage={initialPage}
          issues={data.issues}
          key={person.id}
          people={data.people}
        />
      </section>
    </div>
  );
}
