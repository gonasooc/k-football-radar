import { NextResponse } from "next/server";

import { getDataBundle } from "@/lib/data";
import { getFeedContext } from "@/lib/feed-context";
import {
  getFeedPagination,
  hasFeedSnapshotMismatch
} from "@/lib/feed-page";
import { getFeedFiltersFromSearchParams } from "@/lib/filter";
import { getSourceLinkPage } from "@/lib/source-link-page";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const data = await getDataBundle();
  const { feedItems, revision } = getFeedContext(data);
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
  if (hasFeedSnapshotMismatch(searchParams.snapshot, revision, pagination.offset)) {
    return NextResponse.json(
      { error: "source_links_snapshot_mismatch", snapshot: revision },
      {
        status: 409,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  const page = getSourceLinkPage(feedItems, filters, {
    ...pagination,
    snapshot: revision
  });

  return NextResponse.json(page, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600"
    }
  });
}
