import { notFound } from "next/navigation";

import { EmptyState } from "@/components/EmptyState";
import { ItemCard } from "@/components/ItemCard";
import { SectionHeader } from "@/components/SectionHeader";
import { getDataBundle, getItemsForPerson, getPersonById } from "@/lib/data";

export function generateStaticParams() {
  return getDataBundle().people.map((person) => ({ id: person.id }));
}

export default async function PersonDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
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
      <SectionHeader
        description={person.role}
        eyebrow={`${items.length} mentions`}
        title={person.name}
      />
      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        <div className="border border-line bg-white/82 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-ink/48">별칭</p>
          <p className="mt-2 text-sm font-bold text-ink">
            {[person.name, ...person.aliases].join(", ")}
          </p>
        </div>
        <div className="border border-line bg-white/82 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-ink/48">
            검색 키워드
          </p>
          <p className="mt-2 text-sm font-bold text-ink">{person.keywords.join(", ")}</p>
        </div>
        <div className="border border-line bg-white/82 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-ink/48">
            관련 이슈
          </p>
          <p className="mt-2 text-sm font-bold text-ink">
            {relatedIssues.map((issue) => issue.name).join(", ") || "없음"}
          </p>
        </div>
      </div>
      <div className="mt-8 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <ItemCard item={item} issues={data.issues} key={item.id} people={data.people} />
          ))
        ) : (
          <EmptyState title="이 인물이 언급된 수집 항목이 없습니다." />
        )}
      </div>
    </div>
  );
}
