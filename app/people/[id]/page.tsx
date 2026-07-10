import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/EmptyState";
import { ItemCard } from "@/components/ItemCard";
import { SectionHeader } from "@/components/SectionHeader";
import { getDataBundle, getItemsForPerson, getPersonById } from "@/lib/data";

type PersonDetailPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return getDataBundle().people.map((person) => ({ id: person.id }));
}

export async function generateMetadata({ params }: PersonDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const person = getPersonById(id);

  if (!person || !person.published) {
    return { title: "인물을 찾을 수 없음" };
  }

  return {
    title: person.name,
    description: `${person.name} (${person.role}) 관련 한국축구 기사와 공식자료를 확인합니다.`
  };
}

export default async function PersonDetailPage({ params }: PersonDetailPageProps) {
  const { id } = await params;
  const data = getDataBundle();
  const person = getPersonById(id);

  if (!person || !person.published) {
    notFound();
  }

  const items = getItemsForPerson(person.id);
  const relatedIssues = data.issues.filter((issue) =>
    items.some((item) => item.issueTags.includes(issue.id))
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
        <div className="flex items-center justify-between gap-4 pb-2">
          <h2 className="text-sm font-black text-ink" id="person-items-title">
            관련 수집 항목
          </h2>
          <span className="metric-tabular text-xs font-bold text-ink-soft">{items.length}건</span>
        </div>
        {items.length > 0 ? (
          <div className="border-b border-rule">
            {items.map((item) => (
              <ItemCard item={item} issues={data.issues} key={item.id} people={data.people} />
            ))}
          </div>
        ) : (
          <EmptyState
            description="새 자료에서 이 인물이 감지되면 이 화면에 자동으로 표시됩니다."
            title="아직 이 인물과 연결된 자료가 없습니다."
          />
        )}
      </section>
    </div>
  );
}
