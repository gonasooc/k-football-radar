import type { FeedPage } from "./feed-page";
import type { FeedItem } from "./filter";

export type SourceLinkItem = Pick<
  FeedItem,
  "id" | "url" | "title" | "publisher" | "publishedAt"
>;

export type SourceLinkPage = Omit<FeedPage, "items"> & {
  items: SourceLinkItem[];
};

export function toSourceLinkItem({
  id,
  url,
  title,
  publisher,
  publishedAt
}: FeedItem): SourceLinkItem {
  return { id, url, title, publisher, publishedAt };
}

export function toSourceLinkPage(page: FeedPage): SourceLinkPage {
  return {
    ...page,
    items: page.items.map(toSourceLinkItem)
  };
}
