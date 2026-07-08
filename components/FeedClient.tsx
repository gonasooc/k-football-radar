"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { filterItems, type FeedTypeFilter } from "@/lib/filter";
import type { Issue, Person, RadarItem } from "@/lib/schema";
import { EmptyState } from "./EmptyState";
import { ItemCard } from "./ItemCard";

type FeedClientProps = {
  items: RadarItem[];
  issues: Issue[];
  people: Person[];
};

export function FeedClient({ items, issues, people }: FeedClientProps) {
  const [typeFilter, setTypeFilter] = useState<FeedTypeFilter>("all");
  const [issueFilter, setIssueFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("all");
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    return filterItems(items, {
      type: typeFilter,
      issueId: issueFilter,
      personId: personFilter,
      query
    });
  }, [items, typeFilter, issueFilter, personFilter, query]);

  const resetFilters = () => {
    setTypeFilter("all");
    setIssueFilter("all");
    setPersonFilter("all");
    setQuery("");
  };

  const hasActiveFilters =
    typeFilter !== "all" ||
    issueFilter !== "all" ||
    personFilter !== "all" ||
    query.trim() !== "";
  const gridItems = filteredItems.slice(0, 6);
  const listItems = filteredItems.slice(6);

  return (
    <div className="space-y-6">
      <div className="border-y border-rule bg-paper/45 px-4 py-4 sm:px-5">
        <div className="grid gap-3 lg:grid-cols-[1.25fr_0.95fr_0.95fr] xl:grid-cols-[1.35fr_0.9fr_0.9fr_0.85fr_auto]">
          <label className="block">
            <span className="mb-2 block text-xs font-black text-ink/55">검색</span>
            <span className="relative block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/40"
              />
              <input
                className="focus-ring h-11 w-full rounded-control border-line bg-canvas pl-10 text-sm font-semibold text-ink placeholder:text-muted"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="제목, 출처, 키워드"
                type="search"
                value={query}
              />
            </span>
          </label>
          <div>
            <span className="mb-2 block text-xs font-black text-ink/55">유형</span>
            <div className="grid grid-cols-3 overflow-hidden rounded-control border border-rule bg-canvas">
              {[
                ["all", "전체"],
                ["news", "뉴스"],
                ["official", "공식"]
              ].map(([value, label]) => (
                <button
                  className={`focus-ring motion-soft min-h-11 text-sm font-black ${
                    typeFilter === value
                      ? "bg-accent text-canvas"
                      : "text-ink/60 hover:bg-panel-strong hover:text-ink"
                  }`}
                  key={value}
                  onClick={() => setTypeFilter(value as FeedTypeFilter)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-2 block text-xs font-black text-ink/55">이슈</span>
            <select
              className="focus-ring h-11 w-full rounded-control border-line bg-canvas text-sm font-bold text-ink"
              onChange={(event) => setIssueFilter(event.target.value)}
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
          <label className="block">
            <span className="mb-2 block text-xs font-black text-ink/55">인물</span>
            <select
              className="focus-ring h-11 w-full rounded-control border-line bg-canvas text-sm font-bold text-ink"
              onChange={(event) => setPersonFilter(event.target.value)}
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
          <div className="flex items-end">
            <button
              className={`focus-ring motion-soft inline-flex h-11 w-full items-center justify-center gap-2 rounded-control border px-3 text-xs font-bold xl:w-auto ${
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
      <div className="flex items-center justify-between gap-3 border-y border-line py-3 text-sm font-bold text-ink/60">
        <span className="metric-tabular">표시 항목 {filteredItems.length}개</span>
        <span>게시 시각 최신순</span>
      </div>
      {filteredItems.length > 0 ? (
        <div className="space-y-6">
          <div className="grid gap-x-6 border-b border-rule md:grid-cols-2 xl:grid-cols-3">
            {gridItems.map((item) => (
              <ItemCard
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
                <ItemCard item={item} issues={issues} key={item.id} people={people} />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState title="조건에 맞는 수집 항목이 없습니다." />
      )}
    </div>
  );
}
