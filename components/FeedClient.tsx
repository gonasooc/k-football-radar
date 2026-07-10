"use client";

import { CircleHelp, Search, X } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

import {
  filterItems,
  type FeedScopeFilter,
  type FeedSortOrder,
  type FeedTypeFilter
} from "@/lib/filter";
import type { Issue, Person, RadarItem } from "@/lib/schema";
import { EmptyState } from "./EmptyState";
import { ItemCard } from "./ItemCard";

const SEARCH_DEBOUNCE_MS = 250;
const FEED_PAGE_SIZE = 30;
const SCOPE_TOOLTIP_ID = "feed-scope-tooltip";
const SCOPE_TOOLTIP_TEXT =
  "주요는 관련도가 높은 기본 수집 항목만 보여줍니다. 전체는 보조 수집 항목까지 포함합니다. 검색어가 있으면 보조 수집도 함께 찾습니다.";
const MemoizedItemCard = memo(ItemCard);

type FeedClientProps = {
  items: RadarItem[];
  issues: Issue[];
  people: Person[];
};

export function FeedClient({ items, issues, people }: FeedClientProps) {
  const [typeFilter, setTypeFilter] = useState<FeedTypeFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<FeedScopeFilter>("primary");
  const [sortOrder, setSortOrder] = useState<FeedSortOrder>("latest");
  const [issueFilter, setIssueFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setVisibleCount(FEED_PAGE_SIZE);
      setQuery(searchInput);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

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
    setTypeFilter("all");
    setScopeFilter("primary");
    setSortOrder("latest");
    setIssueFilter("all");
    setPersonFilter("all");
    setSearchInput("");
    setQuery("");
    setVisibleCount(FEED_PAGE_SIZE);
  };

  const hasActiveFilters =
    typeFilter !== "all" ||
    scopeFilter !== "primary" ||
    sortOrder !== "latest" ||
    issueFilter !== "all" ||
    personFilter !== "all" ||
    searchInput.trim() !== "" ||
    query.trim() !== "";
  const visibleItems = filteredItems.slice(0, visibleCount);
  const gridItems = visibleItems.slice(0, 6);
  const listItems = visibleItems.slice(6);
  const hasMoreItems = visibleItems.length < filteredItems.length;
  const hasSearchQuery = query.trim().length > 0;
  let feedScopeLabel = "전체 피드";
  if (hasSearchQuery) {
    feedScopeLabel = "전체 검색";
  } else if (scopeFilter === "primary") {
    feedScopeLabel = "주요 피드";
  }

  return (
    <div className="space-y-5">
      <div className="border-y border-rule bg-canvas py-3">
        <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
          <label className="relative min-w-[220px] flex-[1_1_260px]">
            <span className="sr-only">검색</span>
            <span className="relative block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink/40"
              />
              <input
                className="focus-ring h-10 w-full rounded-control border-line bg-canvas pl-9 text-sm font-semibold text-ink placeholder:text-muted"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="제목, 출처, 키워드"
                type="search"
                value={searchInput}
              />
            </span>
          </label>
          <div className="flex h-10 min-w-[190px] flex-[0_1_220px] rounded-control border border-rule bg-canvas">
            <span className="flex shrink-0 items-center border-r border-line bg-paper px-2 text-[11px] font-black text-muted">
              유형
            </span>
            <div
              aria-label="유형"
              className="grid min-w-0 flex-1 grid-cols-3 overflow-hidden rounded-r-control"
              role="group"
            >
              {[
                ["all", "전체"],
                ["news", "뉴스"],
                ["official", "공식"]
              ].map(([value, label]) => (
                <button
                  className={`focus-ring motion-soft min-h-10 text-xs font-black ${
                    typeFilter === value
                      ? "bg-accent text-canvas"
                      : "text-ink/60 hover:bg-panel-strong hover:text-ink"
                  }`}
                  key={value}
                  onClick={() => {
                    setVisibleCount(FEED_PAGE_SIZE);
                    setTypeFilter(value as FeedTypeFilter);
                  }}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex h-10 min-w-[170px] flex-[0_1_190px] rounded-control border border-rule bg-canvas">
            <div className="relative flex shrink-0 items-center gap-1 border-r border-line bg-paper px-2 text-[11px] font-black text-muted">
              <span>범위</span>
              <span className="group relative inline-flex">
                <button
                  aria-describedby={SCOPE_TOOLTIP_ID}
                  aria-label="범위 필터 설명"
                  className="focus-ring motion-soft inline-flex size-5 items-center justify-center rounded-control text-ink/45 hover:bg-panel-strong hover:text-ink"
                  type="button"
                >
                  <CircleHelp aria-hidden="true" className="size-3.5" />
                </button>
                <span
                  className="pointer-events-none absolute left-0 top-6 z-20 w-64 max-w-[calc(100vw-2rem)] rounded-panel border border-rule bg-canvas px-3 py-2 text-xs font-semibold leading-5 text-ink-soft opacity-0 shadow-panel transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                  id={SCOPE_TOOLTIP_ID}
                  role="tooltip"
                >
                  {SCOPE_TOOLTIP_TEXT}
                </span>
              </span>
            </div>
            <div
              aria-label="범위"
              className="grid min-w-0 flex-1 grid-cols-2 overflow-hidden rounded-r-control"
              role="group"
            >
              {[
                ["primary", "주요"],
                ["all", "전체"]
              ].map(([value, label]) => (
                <button
                  className={`focus-ring motion-soft min-h-10 text-xs font-black ${
                    scopeFilter === value
                      ? "bg-accent text-canvas"
                      : "text-ink/60 hover:bg-panel-strong hover:text-ink"
                  }`}
                  key={value}
                  onClick={() => {
                    setVisibleCount(FEED_PAGE_SIZE);
                    setScopeFilter(value as FeedScopeFilter);
                  }}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex h-10 min-w-[150px] flex-[1_1_180px] overflow-hidden rounded-control border border-line bg-canvas focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent xl:flex-[0_1_180px]">
            <span className="flex shrink-0 items-center border-r border-line bg-paper px-2 text-[11px] font-black text-muted">
              이슈
            </span>
            <select
              className="h-full min-w-0 flex-1 border-0 bg-canvas py-0 pl-2 pr-8 text-sm font-bold text-ink focus:ring-0"
              onChange={(event) => {
                setVisibleCount(FEED_PAGE_SIZE);
                setIssueFilter(event.target.value);
              }}
              value={issueFilter}
            >
              <option value="all">전체</option>
              {issues.map((issue) => (
                <option key={issue.id} value={issue.id}>
                  {issue.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-10 min-w-[150px] flex-[1_1_180px] overflow-hidden rounded-control border border-line bg-canvas focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent xl:flex-[0_1_180px]">
            <span className="flex shrink-0 items-center border-r border-line bg-paper px-2 text-[11px] font-black text-muted">
              인물
            </span>
            <select
              className="h-full min-w-0 flex-1 border-0 bg-canvas py-0 pl-2 pr-8 text-sm font-bold text-ink focus:ring-0"
              onChange={(event) => {
                setVisibleCount(FEED_PAGE_SIZE);
                setPersonFilter(event.target.value);
              }}
              value={personFilter}
            >
              <option value="all">전체</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex min-w-[96px] flex-[1_1_96px] items-center xl:flex-none">
            <button
              className={`focus-ring motion-soft inline-flex h-10 w-full items-center justify-center gap-2 rounded-control border px-3 text-xs font-bold xl:w-auto ${
                hasActiveFilters
                  ? "border-rule bg-canvas text-ink-soft hover:border-accent-soft hover:bg-blush hover:text-accent"
                  : "cursor-not-allowed border-line bg-panel-strong text-muted"
              }`}
              disabled={!hasActiveFilters}
              onClick={resetFilters}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
              초기화
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 pt-1 text-sm font-bold text-ink/60">
        <span className="metric-tabular">
          표시 항목 {visibleItems.length} / 검색 결과 {filteredItems.length}개
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span>{feedScopeLabel}</span>
          <div
            aria-label="정렬"
            className="grid grid-cols-2 overflow-hidden rounded-control border border-rule bg-canvas"
            role="group"
          >
            {[
              ["latest", "최신순"],
              ["relevance", "관련도순"]
            ].map(([value, label]) => (
              <button
                className={`focus-ring motion-soft min-h-9 px-3 text-xs font-black ${
                  sortOrder === value
                    ? "bg-accent text-canvas"
                    : "text-ink/60 hover:bg-panel-strong hover:text-ink"
                }`}
                key={value}
                onClick={() => {
                  setVisibleCount(FEED_PAGE_SIZE);
                  setSortOrder(value as FeedSortOrder);
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {filteredItems.length > 0 ? (
        <div className="space-y-6">
          <div className="grid gap-x-6 border-b border-rule md:grid-cols-2 xl:grid-cols-3">
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
                className="focus-ring motion-soft min-h-11 rounded-control border border-rule bg-canvas px-4 text-sm font-black text-ink-soft hover:border-accent-soft hover:bg-blush hover:text-accent"
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
        <EmptyState title="조건에 맞는 수집 항목이 없습니다." />
      )}
    </div>
  );
}
