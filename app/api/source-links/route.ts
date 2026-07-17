import { NextResponse } from "next/server";

import { getDataBundle } from "@/lib/data";
import {
  getFeedPagination,
  hasFeedSnapshotMismatch
} from "@/lib/feed-page";
import { getFeedContentRevision } from "@/lib/feed-snapshot";
import { getFeedFiltersFromSearchParams, toFeedItems } from "@/lib/filter";
import { getSourceLinkPage } from "@/lib/source-link-page";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const data = await getDataBundle();
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams);
  const filters = getFeedFiltersFromSearchParams(searchParams, {
    issueIds: new Set(data.issues.map((issue) => issue.id)),
    personIds: new Set(data.people.map((person) => person.id))
  });
  const pagination = getFeedPagination({
    offset: searchParams.offset,
    limit: searchParams.limit
  });
  const snapshot = getFeedContentRevision(data.items, data.storyClusters);

  if (hasFeedSnapshotMismatch(searchParams.snapshot, snapshot, pagination.offset)) {
    return NextResponse.json(
      { error: "source_links_snapshot_mismatch", snapshot },
      {
        status: 409,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  const page = getSourceLinkPage(toFeedItems(data.items), filters, {
    ...pagination,
    snapshot
  });

  return NextResponse.json(page, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600"
    }
  });
}
