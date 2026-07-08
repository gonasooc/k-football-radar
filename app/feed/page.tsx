import { FeedClient } from "@/components/FeedClient";
import { SectionHeader } from "@/components/SectionHeader";
import { getDataBundle } from "@/lib/data";

export default function FeedPage() {
  const data = getDataBundle();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SectionHeader
        description="전체 수집 결과를 최신순으로 보고, 유형·이슈·인물·키워드 기준으로 좁혀봅니다."
        eyebrow="전체 기사"
        title="전체 수집 피드"
      />
      <div className="mt-8">
        <FeedClient items={data.items} issues={data.issues} people={data.people} />
      </div>
    </div>
  );
}
