"use client";

import { Check, CircleHelp, LoaderCircle, Search, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from "react";

import {
  DEFAULT_FEED_PAGE_SIZE,
  getFeedRequestSearchParams,
  type FeedPage
} from "@/lib/feed-page";
import { FeedSnapshotMismatchError, fetchFeedPage } from "@/lib/feed-api";
import {
  defaultFeedFilters,
  getFeedFiltersFromSearchParams,
  type FeedFilters,
  type FeedScopeFilter,
  type FeedSortOrder,
  type FeedTypeFilter
} from "@/lib/filter";
import type { Issue, Person } from "@/lib/schema";
import { EmptyState } from "./EmptyState";
import { FeedResultsSkeleton } from "./LoadingSkeletons";
import { StoryFeedEntryCard } from "./StoryFeedEntryCard";

const SEARCH_DEBOUNCE_MS = 250;
const FEATURED_ITEM_COUNT = 3;
const SCOPE_HELP_ID = "feed-scope-help";
const ADVANCED_FILTERS_ID = "feed-advanced-filters";
const NEWS_SCOPE_HELP_TEXT =
  "주요는 관련도가 높은 기본 수집 항목만 보여줍니다. 전체는 보조 수집 항목까지 포함합니다. 검색어가 있으면 보조 수집도 함께 찾습니다.";
const YOUTUBE_SCOPE_HELP_TEXT =
  "선별 채널은 수동으로 검토한 채널의 관련 영상만 보여줍니다. 전체 채널은 미선별 채널의 보조 수집 영상까지 포함하며, 검색도 선택한 범위 안에서만 동작합니다.";
const MemoizedStoryFeedEntryCard = memo(StoryFeedEntryCard);

const NEWS_TYPE_OPTIONS: readonly [FeedTypeFilter, string][] = [
  ["all", "전체"],
  ["news", "뉴스"],
  ["official", "공식"]
];
const NEWS_ALLOWED_TYPES = new Set<FeedTypeFilter>(
  NEWS_TYPE_OPTIONS.map(([value]) => value)
);

const NEWS_SCOPE_OPTIONS: readonly [FeedScopeFilter, string][] = [
  ["primary", "주요"],
  ["all", "전체"]
];
const YOUTUBE_SCOPE_OPTIONS: readonly [FeedScopeFilter, string][] = [
  ["primary", "선별 채널"],
  ["all", "전체 채널"]
];

const SORT_OPTIONS: readonly [FeedSortOrder, string][] = [
  ["latest", "최신순"],
  ["relevance", "관련도순"]
];

type FeedClientProps = {
  initialFilters: FeedFilters;
  initialPage: FeedPage;
  issues: Issue[];
  people: Person[];
  mode?: "news" | "youtube";
};

function syncFiltersToUrl(filters: FeedFilters, omitType = false) {
  const params = getFeedRequestSearchParams(filters);
  if (omitType) params.delete("type");
  const queryString = params.toString();
  const nextUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
  const currentUrl = `${window.location.pathname}${window.location.search}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}

export function FeedClient({
  initialFilters,
  initialPage,
  issues,
  people,
  mode = "news"
}: FeedClientProps) {
  const baseFilters = useMemo<FeedFilters>(
    () => ({ ...defaultFeedFilters, type: mode === "youtube" ? "youtube" : "all" }),
    [mode]
  );
  const scopeOptions =
    mode === "youtube" ? YOUTUBE_SCOPE_OPTIONS : NEWS_SCOPE_OPTIONS;
  const scopeHelpText =
    mode === "youtube" ? YOUTUBE_SCOPE_HELP_TEXT : NEWS_SCOPE_HELP_TEXT;
  const showTypeFilter = mode === "news";
  const routeSearchParams = useSearchParams();
  const issueIds = useMemo(() => new Set(issues.map((issue) => issue.id)), [issues]);
  const personIds = useMemo(() => new Set(people.map((person) => person.id)), [people]);
  const routeFilters = useMemo(
    () =>
      routeSearchParams
        ? getFeedFiltersFromSearchParams(Object.fromEntries(routeSearchParams.entries()), {
            issueIds,
            personIds,
            allowedTypes: mode === "news" ? NEWS_ALLOWED_TYPES : undefined,
            forcedType: mode === "youtube" ? "youtube" : undefined
          })
        : initialFilters,
    [initialFilters, issueIds, mode, personIds, routeSearchParams]
  );
  const routeFilterKey = getFeedRequestSearchParams(routeFilters).toString();
  const [typeFilter, setTypeFilter] = useState<FeedTypeFilter>(initialFilters.type);
  const [scopeFilter, setScopeFilter] = useState<FeedScopeFilter>(initialFilters.scope);
  const [sortOrder, setSortOrder] = useState<FeedSortOrder>(initialFilters.sort);
  const [issueFilter, setIssueFilter] = useState(initialFilters.issueId);
  const [personFilter, setPersonFilter] = useState(initialFilters.personId);
  const [searchInput, setSearchInput] = useState(initialFilters.query);
  const [query, setQuery] = useState(initialFilters.query);
  const [results, setResults] = useState(initialPage);
  const [showScopeHelp, setShowScopeHelp] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(
    initialFilters.scope !== defaultFeedFilters.scope ||
      initialFilters.issueId !== defaultFeedFilters.issueId ||
      initialFilters.personId !== defaultFeedFilters.personId
  );
  const [isResultsLoading, setIsResultsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const skipInitialRequest = useRef(true);
  const activeFilterKey = useRef(getFeedRequestSearchParams(initialFilters).toString());
  const lastObservedRouteFilterKey = useRef(routeFilterKey);
  const filterRequestId = useRef(0);
  const loadMoreRequestId = useRef(0);
  const scopeHelpButtonRef = useRef<HTMLButtonElement>(null);

  const appliedFilters = useMemo<FeedFilters>(
    () => ({
      type: typeFilter,
      scope: scopeFilter,
      sort: sortOrder,
      issueId: issueFilter,
      personId: personFilter,
      query
    }),
    [typeFilter, scopeFilter, sortOrder, issueFilter, personFilter, query]
  );
  const filterKey = getFeedRequestSearchParams(appliedFilters).toString();

  useEffect(() => {
    if (lastObservedRouteFilterKey.current === routeFilterKey) {
      return;
    }

    lastObservedRouteFilterKey.current = routeFilterKey;
    if (routeFilterKey === filterKey) {
      return;
    }

    filterRequestId.current += 1;
    loadMoreRequestId.current += 1;
    setTypeFilter(routeFilters.type);
    setScopeFilter(routeFilters.scope);
    setSortOrder(routeFilters.sort);
    setIssueFilter(routeFilters.issueId);
    setPersonFilter(routeFilters.personId);
    setSearchInput(routeFilters.query);
    setQuery(routeFilters.query);
    setShowScopeHelp(false);
    setShowAdvancedFilters(
      routeFilters.scope !== defaultFeedFilters.scope ||
        routeFilters.issueId !== defaultFeedFilters.issueId ||
        routeFilters.personId !== defaultFeedFilters.personId
    );
    setIsLoadingMore(false);
    setLoadError(false);
  }, [filterKey, routeFilterKey, routeFilters]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setQuery(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    activeFilterKey.current = filterKey;
    loadMoreRequestId.current += 1;
    setIsLoadingMore(false);
    syncFiltersToUrl(appliedFilters, mode === "youtube");

    if (skipInitialRequest.current) {
      skipInitialRequest.current = false;
      return;
    }

    const controller = new AbortController();
    const requestId = ++filterRequestId.current;
    setIsResultsLoading(true);
    setLoadError(false);

    fetchFeedPage(appliedFilters, 0, {
      signal: controller.signal,
      sourceScope: mode === "news" ? "editorial" : undefined
    })
      .then((page) => {
        if (filterRequestId.current === requestId && activeFilterKey.current === filterKey) {
          setResults(page);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        if (filterRequestId.current === requestId && activeFilterKey.current === filterKey) {
          setLoadError(true);
          setResults((current) => ({
            entries: [],
            totalEntries: 0,
            totalItems: 0,
            offset: 0,
            limit: DEFAULT_FEED_PAGE_SIZE,
            hasMore: false,
            snapshot: current.snapshot
          }));
        }
      })
      .finally(() => {
        if (filterRequestId.current === requestId && activeFilterKey.current === filterKey) {
          setIsResultsLoading(false);
        }
      });

    return () => controller.abort();
  }, [appliedFilters, filterKey, mode]);

  const resetFilters = () => {
    setTypeFilter(baseFilters.type);
    setScopeFilter(baseFilters.scope);
    setSortOrder(baseFilters.sort);
    setIssueFilter(baseFilters.issueId);
    setPersonFilter(baseFilters.personId);
    setSearchInput(baseFilters.query);
    setQuery(baseFilters.query);
    setShowScopeHelp(false);
    setShowAdvancedFilters(false);
  };

  const loadMore = async () => {
    if (isLoadingMore || isResultsPending || !results.hasMore) {
      return;
    }

    const requestedFilterKey = filterKey;
    const requestedOffset = results.entries.length;
    const requestedSnapshot = results.snapshot;
    const requestId = ++loadMoreRequestId.current;
    setIsLoadingMore(true);
    setLoadError(false);

    try {
      const page = await fetchFeedPage(appliedFilters, requestedOffset, {
        snapshot: requestedSnapshot,
        sourceScope: mode === "news" ? "editorial" : undefined
      });
      if (
        loadMoreRequestId.current !== requestId ||
        activeFilterKey.current !== requestedFilterKey
      ) {
        return;
      }
      setResults((current) => {
        if (
          current.entries.length !== requestedOffset ||
          current.snapshot !== requestedSnapshot
        ) {
          return current;
        }

        const entries = [...current.entries, ...page.entries];
        return {
          ...page,
          entries,
          offset: 0,
          limit: entries.length
        };
      });
    } catch (error) {
      if (
        loadMoreRequestId.current !== requestId ||
        activeFilterKey.current !== requestedFilterKey
      ) {
        return;
      }
      if (error instanceof FeedSnapshotMismatchError) {
        try {
          const freshPage = await fetchFeedPage(appliedFilters, 0, {
            snapshot: error.snapshot,
            sourceScope: mode === "news" ? "editorial" : undefined
          });
          if (
            loadMoreRequestId.current === requestId &&
            activeFilterKey.current === requestedFilterKey
          ) {
            setResults(freshPage);
          }
        } catch {
          if (
            loadMoreRequestId.current === requestId &&
            activeFilterKey.current === requestedFilterKey
          ) {
            setLoadError(true);
          }
        }
        return;
      }
      setLoadError(true);
    } finally {
      if (loadMoreRequestId.current === requestId) {
        setIsLoadingMore(false);
      }
    }
  };

  const closeScopeHelpOnEscape = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") {
      setShowScopeHelp(false);
      event.stopPropagation();
    }
  };

  const normalizedSearchInput = searchInput.trim();
  const isSearchPending = normalizedSearchInput !== query;
  const isResultsPending = isSearchPending || isResultsLoading;
  const hasActiveFilters =
    typeFilter !== baseFilters.type ||
    scopeFilter !== baseFilters.scope ||
    sortOrder !== baseFilters.sort ||
    issueFilter !== baseFilters.issueId ||
    personFilter !== baseFilters.personId ||
    normalizedSearchInput !== "" ||
    query !== "";
  const filterControlCount =
    Number(showTypeFilter && typeFilter !== baseFilters.type) +
    Number(scopeFilter !== baseFilters.scope) +
    Number(issueFilter !== baseFilters.issueId) +
    Number(personFilter !== baseFilters.personId);
  const hasSearchQuery = query.length > 0;
  const gridEntries = hasSearchQuery
    ? []
    : results.entries.slice(0, FEATURED_ITEM_COUNT);
  const listEntries = hasSearchQuery
    ? results.entries
    : results.entries.slice(FEATURED_ITEM_COUNT);
  let feedScopeLabel = mode === "youtube" ? "전체 채널 영상" : "전체 피드";

  if (hasSearchQuery) {
    feedScopeLabel =
      mode === "youtube"
        ? scopeFilter === "primary"
          ? "선별 채널 검색"
          : "전체 채널 검색"
        : "전체 검색";
  } else if (scopeFilter === "primary") {
    feedScopeLabel = mode === "youtube" ? "선별 채널 영상" : "주요 피드";
  }

  return (
    <div className="space-y-5">
      <section aria-label="피드 필터" className="border-y border-rule py-3">
        <div
          className={`grid grid-cols-1 gap-2 min-[360px]:grid-cols-[minmax(0,1fr)_auto] ${
            showTypeFilter
              ? "lg:grid-cols-[minmax(260px,1fr)_260px_auto]"
              : "lg:grid-cols-[minmax(260px,1fr)_auto]"
          }`}
        >
          <label className="relative min-w-0">
            <span className="sr-only">검색</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <input
              className="focus-ring h-11 w-full rounded-control border-line bg-canvas pl-10 pr-3 text-base font-semibold text-ink placeholder:text-muted md:text-sm"
              maxLength={200}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={
                mode === "youtube"
                  ? "영상 제목, 채널, 키워드 검색"
                  : "제목, 출처, 키워드 검색"
              }
              type="search"
              value={searchInput}
            />
          </label>

          {showTypeFilter ? (
            <div className="hidden h-11 min-w-0 overflow-hidden rounded-control border border-rule bg-canvas lg:flex">
              <span className="flex shrink-0 items-center border-r border-line bg-paper px-3 text-[11px] font-black text-muted">
                유형
              </span>
              <div
                aria-label="자료 유형"
                className="grid min-w-0 flex-1 grid-cols-3"
                role="group"
              >
                {NEWS_TYPE_OPTIONS.map(([value, label]) => {
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
                      onClick={() => setTypeFilter(value)}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

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
              {showTypeFilter ? (
                <div className="lg:hidden">
                  <span className="mb-1.5 flex min-h-7 items-center text-[11px] font-black text-muted">
                    자료 유형
                  </span>
                  <div
                    aria-label="모바일 자료 유형"
                    className="grid h-11 grid-cols-3 overflow-hidden rounded-control border border-rule bg-canvas"
                    role="group"
                  >
                    {NEWS_TYPE_OPTIONS.map(([value, label]) => {
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
                          onClick={() => setTypeFilter(value)}
                          type="button"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div
                className="relative"
                onMouseLeave={() => {
                  if (document.activeElement !== scopeHelpButtonRef.current) {
                    setShowScopeHelp(false);
                  }
                }}
              >
                <div className="mb-1.5 flex min-h-7 items-center">
                  <span className="text-[11px] font-black text-muted">
                    {mode === "youtube" ? "채널 범위" : "수집 범위"}
                  </span>
                  <button
                    aria-describedby={showScopeHelp ? SCOPE_HELP_ID : undefined}
                    aria-expanded={showScopeHelp}
                    aria-label={mode === "youtube" ? "채널 범위 설명" : "수집 범위 설명"}
                    className="focus-ring motion-soft absolute -top-2 right-0 z-30 inline-flex size-11 items-center justify-center rounded-control text-muted hover:bg-paper hover:text-ink"
                    onBlur={() => setShowScopeHelp(false)}
                    onClick={() => setShowScopeHelp(true)}
                    onFocus={() => setShowScopeHelp(true)}
                    onKeyDown={closeScopeHelpOnEscape}
                    onMouseEnter={() => setShowScopeHelp(true)}
                    ref={scopeHelpButtonRef}
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
                    {scopeHelpText}
                  </div>
                ) : null}
                <div
                  aria-label={mode === "youtube" ? "채널 범위" : "수집 범위"}
                  className="grid h-11 grid-cols-2 overflow-hidden rounded-control border border-rule bg-canvas"
                  role="group"
                >
                  {scopeOptions.map(([value, label]) => {
                    const selected = scopeFilter === value;
                    return (
                      <button
                        aria-pressed={selected}
                        className={`focus-ring motion-soft min-h-11 text-xs font-black ${
                          selected ? "bg-accent text-canvas" : "text-ink-soft hover:bg-paper hover:text-ink"
                        }`}
                        key={value}
                        onClick={() => setScopeFilter(value)}
                        type="button"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label>
                <span className="mb-1.5 flex min-h-7 items-center text-[11px] font-black text-muted">이슈</span>
                <select
                  className="h-11 w-full rounded-control border-line bg-canvas py-0 pl-3 pr-9 text-base font-bold text-ink focus:border-accent focus:ring-accent md:text-sm"
                  onChange={(event) => setIssueFilter(event.target.value)}
                  value={issueFilter}
                >
                  <option value="all">모든 이슈</option>
                  {issues.map((issue) => (
                    <option key={issue.id} value={issue.id}>{issue.name}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1.5 flex min-h-7 items-center text-[11px] font-black text-muted">인물</span>
                <select
                  className="h-11 w-full rounded-control border-line bg-canvas py-0 pl-3 pr-9 text-base font-bold text-ink focus:border-accent focus:ring-accent md:text-sm"
                  onChange={(event) => setPersonFilter(event.target.value)}
                  value={personFilter}
                >
                  <option value="all">모든 인물</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <p
          aria-atomic="true"
          aria-live="polite"
          className="metric-tabular flex min-w-0 flex-wrap items-center gap-y-1 text-sm font-bold leading-5 text-ink-soft"
          role="status"
        >
          {isResultsPending ? (
            <span className="inline-flex items-center gap-1.5 text-accent">
              <LoaderCircle aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
              {isSearchPending ? "검색어 적용 중…" : "필터 적용 중…"}
            </span>
          ) : (
            <>
              {hasSearchQuery ? (
                <span className="inline-flex max-w-full items-center text-ink">
                  <Check aria-hidden="true" className="mr-1.5 size-3.5 shrink-0 text-accent" />
                  <span className="max-w-20 truncate sm:max-w-72">‘{query}’</span>
                  <span className="shrink-0 text-ink-soft"> 검색 완료</span>
                </span>
              ) : null}
              {hasSearchQuery ? <span className="text-muted"> · </span> : null}
              <span className="text-ink">
                {results.totalEntries}개 {mode === "youtube" ? "영상 주제" : "주제·자료"}
              </span>
              {mode === "news" ? (
                <span className="text-muted"> · 원문 {results.totalItems}건</span>
              ) : mode === "youtube" ? (
                <span className="text-muted"> · 영상 {results.totalItems}건</span>
              ) : null}
              <span className="text-muted"> · {results.entries.length}개 표시</span>
            </>
          )}
        </p>
        <div className="ml-auto flex min-w-0 items-center justify-between gap-3 sm:justify-end">
          <span className="hidden shrink-0 text-xs font-bold text-muted sm:inline">{feedScopeLabel}</span>
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
                    selected ? "bg-accent text-canvas" : "text-ink-soft hover:bg-paper hover:text-ink"
                  }`}
                  key={value}
                  onClick={() => setSortOrder(value)}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div aria-busy={isResultsPending || isLoadingMore}>
        {isResultsPending ? (
          <FeedResultsSkeleton oneColumn={normalizedSearchInput.length > 0} />
        ) : loadError && results.entries.length === 0 ? (
          <EmptyState
            description="잠시 후 다시 시도해 주세요. 기존 주소와 필터 상태는 유지됩니다."
            title="수집 항목을 불러오지 못했습니다."
          />
        ) : results.entries.length > 0 ? (
          <div className="space-y-6">
            {gridEntries.length > 0 ? (
              <div className="grid border-b border-rule lg:grid-cols-3 lg:divide-x lg:divide-line">
                {gridEntries.map((entry) => (
                  <MemoizedStoryFeedEntryCard
                    entry={entry}
                    highlightQuery={query}
                    issues={issues}
                    key={entry.id}
                    people={people}
                    variant="compact"
                  />
                ))}
              </div>
            ) : null}
            {listEntries.length > 0 ? (
              <div className="border-b border-rule">
                {listEntries.map((entry) => (
                  <MemoizedStoryFeedEntryCard
                    entry={entry}
                    highlightQuery={query}
                    issues={issues}
                    key={entry.id}
                    people={people}
                  />
                ))}
              </div>
            ) : null}
            {loadError ? (
              <p className="text-center text-sm font-bold text-accent" role="status">
                다음 항목을 불러오지 못했습니다. 다시 시도해 주세요.
              </p>
            ) : null}
            {results.hasMore ? (
              <div className="flex justify-center">
                <button
                  className="focus-ring motion-soft inline-flex min-h-11 items-center gap-2 rounded-control border border-rule bg-canvas px-5 text-sm font-black text-ink-soft hover:border-accent-soft hover:bg-blush hover:text-accent disabled:cursor-wait disabled:opacity-60"
                  disabled={isLoadingMore}
                  onClick={loadMore}
                  type="button"
                >
                  {isLoadingMore ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : null}
                  {isLoadingMore ? "불러오는 중" : "더보기"}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            description={
              mode === "youtube" && !hasActiveFilters
                ? "YouTube API 첫 수집이 완료되면 최근 90일의 영상부터 표시됩니다."
                : "검색어를 바꾸거나 선택한 필터를 초기화해 보세요."
            }
            title={
              mode === "youtube" && !hasActiveFilters
                ? "아직 수집된 영상이 없습니다."
                : mode === "youtube"
                ? "조건에 맞는 영상이 없습니다."
                : "조건에 맞는 수집 항목이 없습니다."
            }
          />
        )}
      </div>
    </div>
  );
}
