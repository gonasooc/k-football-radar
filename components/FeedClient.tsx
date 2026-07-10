"use client";

import { CircleHelp, Search, SlidersHorizontal, X } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

import {
  defaultFeedFilters,
  filterItems,
  getFeedFiltersFromSearchParams,
  type FeedFilters,
  type FeedItem,
  type FeedScopeFilter,
  type FeedSortOrder,
  type FeedTypeFilter
} from "@/lib/filter";
import type { Issue, Person } from "@/lib/schema";
import { EmptyState } from "./EmptyState";
import { ItemCard } from "./ItemCard";

const SEARCH_DEBOUNCE_MS = 250;
const FEED_PAGE_SIZE = 30;
const FEATURED_ITEM_COUNT = 3;
const SCOPE_HELP_ID = "feed-scope-help";
const ADVANCED_FILTERS_ID = "feed-advanced-filters";
const SCOPE_HELP_TEXT =
  "주요는 관련도가 높은 기본 수집 항목만 보여줍니다. 전체는 보조 수집 항목까지 포함합니다. 검색어가 있으면 보조 수집도 함께 찾습니다.";
const MemoizedItemCard = memo(ItemCard);

const TYPE_OPTIONS: readonly [FeedTypeFilter, string][] = [
  ["all", "전체"],
  ["news", "뉴스"],
  ["official", "공식"]
];

const SCOPE_OPTIONS: readonly [FeedScopeFilter, string][] = [
  ["primary", "주요"],
  ["all", "전체"]
];

const SORT_OPTIONS: readonly [FeedSortOrder, string][] = [
  ["latest", "최신순"],
  ["relevance", "관련도순"]
];

type FeedClientProps = {
  items: FeedItem[];
  issues: Issue[];
  people: Person[];
};

function syncFiltersToUrl(filters: FeedFilters) {
  const params = new URLSearchParams();

  if (filters.type !== defaultFeedFilters.type) params.set("type", filters.type);
  if (filters.scope !== defaultFeedFilters.scope) params.set("scope", filters.scope);
  if (filters.sort !== defaultFeedFilters.sort) params.set("sort", filters.sort);
  if (filters.issueId !== defaultFeedFilters.issueId) params.set("issue", filters.issueId);
  if (filters.personId !== defaultFeedFilters.personId) params.set("person", filters.personId);
  if (filters.query) params.set("q", filters.query);

  const queryString = params.toString();
  const nextUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
  const currentUrl = `${window.location.pathname}${window.location.search}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}

export function FeedClient({ items, issues, people }: FeedClientProps) {
  const [typeFilter, setTypeFilter] = useState<FeedTypeFilter>(defaultFeedFilters.type);
  const [scopeFilter, setScopeFilter] = useState<FeedScopeFilter>(defaultFeedFilters.scope);
  const [sortOrder, setSortOrder] = useState<FeedSortOrder>(defaultFeedFilters.sort);
  const [issueFilter, setIssueFilter] = useState(defaultFeedFilters.issueId);
  const [personFilter, setPersonFilter] = useState(defaultFeedFilters.personId);
  const [searchInput, setSearchInput] = useState(defaultFeedFilters.query);
  const [query, setQuery] = useState(defaultFeedFilters.query);
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE);
  const [showScopeHelp, setShowScopeHelp] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isUrlInitialized, setIsUrlInitialized] = useState(false);

  useEffect(() => {
    const urlFilters = getFeedFiltersFromSearchParams(
      Object.fromEntries(new URLSearchParams(window.location.search)),
      {
        issueIds: new Set(issues.map((issue) => issue.id)),
        personIds: new Set(people.map((person) => person.id))
      }
    );

    setTypeFilter(urlFilters.type);
    setScopeFilter(urlFilters.scope);
    setSortOrder(urlFilters.sort);
    setIssueFilter(urlFilters.issueId);
    setPersonFilter(urlFilters.personId);
    setSearchInput(urlFilters.query);
    setQuery(urlFilters.query);
    setShowAdvancedFilters(
      urlFilters.scope !== defaultFeedFilters.scope ||
        urlFilters.issueId !== defaultFeedFilters.issueId ||
        urlFilters.personId !== defaultFeedFilters.personId
    );
    setIsUrlInitialized(true);
  }, [issues, people]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setVisibleCount(FEED_PAGE_SIZE);
      setQuery(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  useEffect(() => {
    if (!isUrlInitialized) {
      return;
    }

    syncFiltersToUrl({
      type: typeFilter,
      scope: scopeFilter,
      sort: sortOrder,
      issueId: issueFilter,
      personId: personFilter,
      query
    });
  }, [
    isUrlInitialized,
    typeFilter,
    scopeFilter,
    sortOrder,
    issueFilter,
    personFilter,
    query
  ]);

  const filteredItems = useMemo(() => {
    return filterItems(items, {
      type: typeFilter,
      scope: scopeFilter,
      sort: sortOrder,
      issueId: issueFilter,
      personId: personFilter,
      query
    });
  }, [items, typeFilter, scopeFilter, sortOrder, issueFilter, personFilter, query]);

  const resetFilters = () => {
    setTypeFilter(defaultFeedFilters.type);
    setScopeFilter(defaultFeedFilters.scope);
    setSortOrder(defaultFeedFilters.sort);
    setIssueFilter(defaultFeedFilters.issueId);
    setPersonFilter(defaultFeedFilters.personId);
    setSearchInput(defaultFeedFilters.query);
    setQuery(defaultFeedFilters.query);
    setVisibleCount(FEED_PAGE_SIZE);
    setShowScopeHelp(false);
    setShowAdvancedFilters(false);
  };

  const hasActiveFilters =
    typeFilter !== defaultFeedFilters.type ||
    scopeFilter !== defaultFeedFilters.scope ||
    sortOrder !== defaultFeedFilters.sort ||
    issueFilter !== defaultFeedFilters.issueId ||
    personFilter !== defaultFeedFilters.personId ||
    searchInput.trim() !== "" ||
    query !== "";
  const filterControlCount =
    Number(typeFilter !== defaultFeedFilters.type) +
    Number(scopeFilter !== defaultFeedFilters.scope) +
    Number(issueFilter !== defaultFeedFilters.issueId) +
    Number(personFilter !== defaultFeedFilters.personId);
  const visibleItems = filteredItems.slice(0, visibleCount);
  const gridItems = visibleItems.slice(0, FEATURED_ITEM_COUNT);
  const listItems = visibleItems.slice(FEATURED_ITEM_COUNT);
  const hasMoreItems = visibleItems.length < filteredItems.length;
  const hasSearchQuery = query.length > 0;
  let feedScopeLabel = "전체 피드";

  if (hasSearchQuery) {
    feedScopeLabel = "전체 검색";
  } else if (scopeFilter === "primary") {
    feedScopeLabel = "주요 피드";
  }

  return (
    <div className="space-y-5">
      <section aria-label="피드 필터" className="border-y border-rule py-3">
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(260px,1fr)_260px_auto]">
          <label className="relative min-w-0">
            <span className="sr-only">검색</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <input
              className="focus-ring h-11 w-full rounded-control border-line bg-canvas pl-10 pr-3 text-sm font-semibold text-ink placeholder:text-muted"
              maxLength={200}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="제목, 출처, 키워드 검색"
              type="search"
              value={searchInput}
            />
          </label>

          <div className="hidden h-11 min-w-0 overflow-hidden rounded-control border border-rule bg-canvas lg:flex">
            <span className="flex shrink-0 items-center border-r border-line bg-paper px-3 text-[11px] font-black text-muted">
              유형
            </span>
            <div aria-label="자료 유형" className="grid min-w-0 flex-1 grid-cols-3" role="group">
              {TYPE_OPTIONS.map(([value, label]) => {
                const selected = typeFilter === value;

                return (
                  <button
                    aria-pressed={selected}
                    className={`focus-ring motion-soft min-h-11 text-xs font-black ${
                      selected
                        ? "bg-accent text-canvas"
                        : "text-ink-soft hover:bg-paper hover:text-ink"
                    }`}
                    key={value}
                    onClick={() => {
                      setVisibleCount(FEED_PAGE_SIZE);
                      setTypeFilter(value);
                    }}
                    type="button"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              aria-controls={ADVANCED_FILTERS_ID}
              aria-expanded={showAdvancedFilters}
              className="focus-ring motion-soft inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control border border-rule bg-canvas px-3 text-xs font-black text-ink-soft hover:border-accent-soft hover:bg-blush hover:text-accent min-[360px]:flex-none"
              onClick={() => setShowAdvancedFilters((current) => !current)}
              type="button"
            >
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              <span className="lg:hidden">필터</span>
              <span className="hidden lg:inline">상세 필터</span>
              {filterControlCount > 0 ? (
                <span className="metric-tabular inline-flex min-w-5 items-center justify-center rounded-chip bg-accent px-1.5 py-0.5 text-[10px] text-canvas">
                  {filterControlCount}
                </span>
              ) : null}
            </button>
            {hasActiveFilters ? (
              <button
                className="focus-ring motion-soft inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control border border-rule bg-canvas px-3 text-xs font-black text-ink-soft hover:border-accent-soft hover:bg-blush hover:text-accent"
                onClick={resetFilters}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
                <span className="sr-only sm:not-sr-only">초기화</span>
              </button>
            ) : null}
          </div>
        </div>

        {showAdvancedFilters ? (
          <div className="mt-3 border-t border-line pt-3" id={ADVANCED_FILTERS_ID}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,0.8fr)_1fr_1fr]">
              <div className="lg:hidden">
                <span className="mb-1.5 flex min-h-7 items-center text-[11px] font-black text-muted">
                  자료 유형
                </span>
                <div
                  aria-label="모바일 자료 유형"
                  className="grid h-11 grid-cols-3 overflow-hidden rounded-control border border-rule bg-canvas"
                  role="group"
                >
                  {TYPE_OPTIONS.map(([value, label]) => {
                    const selected = typeFilter === value;

                    return (
                      <button
                        aria-pressed={selected}
                        className={`focus-ring motion-soft min-h-11 text-xs font-black ${
                          selected
                            ? "bg-accent text-canvas"
                            : "text-ink-soft hover:bg-paper hover:text-ink"
                        }`}
                        key={value}
                        onClick={() => {
                          setVisibleCount(FEED_PAGE_SIZE);
                          setTypeFilter(value);
                        }}
                        type="button"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <div className="mb-1.5 flex min-h-7 items-center">
                  <span className="text-[11px] font-black text-muted">수집 범위</span>
                  <button
                    aria-describedby={showScopeHelp ? SCOPE_HELP_ID : undefined}
                    aria-expanded={showScopeHelp}
                    aria-label="수집 범위 설명"
                    className="focus-ring motion-soft absolute -top-2 right-0 z-30 inline-flex size-11 items-center justify-center rounded-control text-muted hover:bg-paper hover:text-ink"
                    onBlur={() => setShowScopeHelp(false)}
                    onClick={() => setShowScopeHelp(true)}
                    onFocus={() => setShowScopeHelp(true)}
                    onMouseEnter={() => setShowScopeHelp(true)}
                    onMouseLeave={() => setShowScopeHelp(false)}
                    type="button"
                  >
                    <CircleHelp aria-hidden="true" className="size-4" />
                  </button>
                </div>
                {showScopeHelp ? (
                  <div
                    className="absolute right-0 top-10 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-panel border border-rule bg-canvas px-3 py-2 text-xs font-semibold leading-5 text-ink-soft shadow-panel"
                    id={SCOPE_HELP_ID}
                    role="tooltip"
                  >
                    {SCOPE_HELP_TEXT}
                  </div>
                ) : null}
                <div
                  aria-label="수집 범위"
                  className="grid h-11 grid-cols-2 overflow-hidden rounded-control border border-rule bg-canvas"
                  role="group"
                >
                  {SCOPE_OPTIONS.map(([value, label]) => {
                    const selected = scopeFilter === value;

                    return (
                      <button
                        aria-pressed={selected}
                        className={`focus-ring motion-soft min-h-11 text-xs font-black ${
                          selected
                            ? "bg-accent text-canvas"
                            : "text-ink-soft hover:bg-paper hover:text-ink"
                        }`}
                        key={value}
                        onClick={() => {
                          setVisibleCount(FEED_PAGE_SIZE);
                          setScopeFilter(value);
                        }}
                        type="button"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label>
                <span className="mb-1.5 flex min-h-7 items-center text-[11px] font-black text-muted">
                  이슈
                </span>
                <select
                  className="h-11 w-full rounded-control border-line bg-canvas py-0 pl-3 pr-9 text-sm font-bold text-ink focus:border-accent focus:ring-accent"
                  onChange={(event) => {
                    setVisibleCount(FEED_PAGE_SIZE);
                    setIssueFilter(event.target.value);
                  }}
                  value={issueFilter}
                >
                  <option value="all">모든 이슈</option>
                  {issues.map((issue) => (
                    <option key={issue.id} value={issue.id}>
                      {issue.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1.5 flex min-h-7 items-center text-[11px] font-black text-muted">
                  인물
                </span>
                <select
                  className="h-11 w-full rounded-control border-line bg-canvas py-0 pl-3 pr-9 text-sm font-bold text-ink focus:border-accent focus:ring-accent"
                  onChange={(event) => {
                    setVisibleCount(FEED_PAGE_SIZE);
                    setPersonFilter(event.target.value);
                  }}
                  value={personFilter}
                >
                  <option value="all">모든 인물</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

          </div>
        ) : null}
      </section>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <p
          aria-live="polite"
          className="metric-tabular text-sm font-bold text-ink-soft"
          role="status"
        >
          <span className="text-ink">{filteredItems.length}개 결과</span>
          <span className="text-muted"> · {visibleItems.length}개 표시</span>
        </p>
        <div className="ml-auto flex min-w-0 items-center justify-between gap-3 sm:justify-end">
          <span className="hidden shrink-0 text-xs font-bold text-muted sm:inline">
            {feedScopeLabel}
          </span>
          <div
            aria-label="정렬 방식"
            className="grid min-w-0 grid-cols-2 overflow-hidden rounded-control border border-rule bg-canvas"
            role="group"
          >
            {SORT_OPTIONS.map(([value, label]) => {
              const selected = sortOrder === value;

              return (
                <button
                  aria-pressed={selected}
                  className={`focus-ring motion-soft min-h-11 px-3 text-xs font-black ${
                    selected
                      ? "bg-accent text-canvas"
                      : "text-ink-soft hover:bg-paper hover:text-ink"
                  }`}
                  key={value}
                  onClick={() => {
                    setVisibleCount(FEED_PAGE_SIZE);
                    setSortOrder(value);
                  }}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {filteredItems.length > 0 ? (
        <div className="space-y-6">
          <div className="grid border-b border-rule lg:grid-cols-3 lg:divide-x lg:divide-line">
            {gridItems.map((item) => (
              <MemoizedItemCard
                item={item}
                issues={issues}
                key={item.id}
                people={people}
                variant="compact"
              />
            ))}
          </div>
          {listItems.length > 0 ? (
            <div className="border-b border-rule">
              {listItems.map((item) => (
                <MemoizedItemCard item={item} issues={issues} key={item.id} people={people} />
              ))}
            </div>
          ) : null}
          {hasMoreItems ? (
            <div className="flex justify-center">
              <button
                className="focus-ring motion-soft min-h-11 rounded-control border border-rule bg-canvas px-5 text-sm font-black text-ink-soft hover:border-accent-soft hover:bg-blush hover:text-accent"
                onClick={() =>
                  setVisibleCount((current) =>
                    Math.min(current + FEED_PAGE_SIZE, filteredItems.length)
                  )
                }
                type="button"
              >
                더보기
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState
          description="검색어를 바꾸거나 선택한 필터를 초기화해 보세요."
          title="조건에 맞는 수집 항목이 없습니다."
        />
      )}
    </div>
  );
}
