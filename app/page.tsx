import type { Metadata } from "next";

import { HomeFeedSection } from "@/components/HomeFeedSection";
import { getDataBundle } from "@/lib/data";
import { getFeedPage } from "@/lib/feed-page";
import { getFeedContentRevision } from "@/lib/feed-snapshot";
import { defaultFeedFilters, toFeedItems } from "@/lib/filter";

export const metadata: Metadata = {
  title: "홈",
  description: "한국축구 이슈의 최신 뉴스·공식자료와 유튜브 영상을 한눈에 확인합니다."
};

export const dynamic = "force-dynamic";

function latestDate(values: Array<string | undefined>, fallback?: string): string | undefined {
  const timestamps = values.flatMap((value) => {
    if (!value) return [];
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? [{ value, timestamp }] : [];
  });
  return timestamps.sort((left, right) => right.timestamp - left.timestamp)[0]?.value ?? fallback;
}

export default async function HomePage() {
  const data = await getDataBundle();
  const snapshot = getFeedContentRevision(data.items, data.storyClusters);
  const newsPage = getFeedPage(
    toFeedItems(data.items.filter((item) => item.sourceType !== "youtube")),
    defaultFeedFilters,
    {
      limit: 6,
      snapshot,
      storyClusters: data.storyClusters
    }
  );
  const youtubePage = getFeedPage(toFeedItems(data.items), {
    ...defaultFeedFilters,
    type: "youtube"
  }, {
    limit: 6,
    snapshot,
    storyClusters: data.storyClusters
  });
  const newsCollectedAt = latestDate(
    [
      data.collectionState.collectors?.naver?.lastCollectedAt,
      data.collectionState.collectors?.official?.lastCollectedAt
    ],
    data.collectionState.lastCollectedAt
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 pt-7 sm:px-6 sm:pt-9 lg:px-8">
      <h1 className="sr-only">한국축구 최신 뉴스와 유튜브 영상</h1>
      <div className="space-y-14">
        <HomeFeedSection
          emptyDescription="새 기사와 공식자료가 수집되면 이곳에 최신 순서로 표시됩니다."
          emptyTitle="아직 표시할 뉴스가 없습니다."
          href="/news"
          issues={data.issues}
          lastCollectedAt={newsCollectedAt}
          page={newsPage}
          people={data.people}
          title="뉴스"
        />
        <HomeFeedSection
          emptyDescription="YouTube API 설정과 첫 수집이 완료되면 최근 90일의 영상부터 표시됩니다."
          emptyTitle="유튜브 영상 수집을 준비하고 있습니다."
          href="/youtube"
          issues={data.issues}
          lastCollectedAt={data.collectionState.collectors?.youtube?.lastCollectedAt}
          page={youtubePage}
          people={data.people}
          title="유튜브"
        />
      </div>
    </div>
  );
}
