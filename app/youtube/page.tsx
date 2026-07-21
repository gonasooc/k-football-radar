import type { Metadata } from "next";

import { FeedClient } from "@/components/FeedClient";
import { SectionHeader } from "@/components/SectionHeader";
import { getDataBundle } from "@/lib/data";
import { getFeedPage } from "@/lib/feed-page";
import { getFeedContentRevision } from "@/lib/feed-snapshot";
import { getFeedFiltersFromSearchParams, toFeedItems } from "@/lib/filter";
import { pageAlternates } from "@/lib/site";

export const metadata: Metadata = {
  title: "유튜브",
  description: "한국축구 거버넌스 이슈와 관련된 유튜브 영상을 확인합니다.",
  alternates: pageAlternates("/youtube")
};

export const dynamic = "force-dynamic";

type YouTubePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function YouTubePage({ searchParams }: YouTubePageProps) {
  const data = await getDataBundle();
  const initialFilters = getFeedFiltersFromSearchParams(await searchParams, {
    issueIds: new Set(data.issues.map((issue) => issue.id)),
    personIds: new Set(data.people.map((person) => person.id)),
    forcedType: "youtube"
  });
  const initialPage = getFeedPage(toFeedItems(data.items), initialFilters, {
    snapshot: getFeedContentRevision(data.items, data.storyClusters),
    storyClusters: data.storyClusters
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <SectionHeader
        description="선별 채널의 한국축구 분석·인터뷰와 일반 영상 자료를 우선 제공합니다. Shorts는 명확히 판별되는 경우 제외합니다."
        title="유튜브"
      />
      <div className="mt-6">
        <FeedClient
          initialFilters={initialFilters}
          initialPage={initialPage}
          issues={data.issues}
          mode="youtube"
          people={data.people}
        />
      </div>
    </div>
  );
}
