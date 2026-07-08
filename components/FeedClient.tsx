"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
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

  const [leadItem, ...remainingItems] = filteredItems;
  const featuredItems = remainingItems.slice(0, 4);
  const listItems = remainingItems.slice(4);

  return (
    <div className="space-y-6">
      <div className="border-y border-rule bg-canvas py-4">
        <div className="mb-4 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-control border border-rule bg-canvas text-accent">
              <SlidersHorizontal aria-hidden="true" className="size-4" />
            </span>
            <div>
              <p className="font-serif text-xl font-black text-ink">피드 컨트롤</p>
              <p className="text-xs font-semibold text-muted">
                출처, 이슈, 인물, 키워드로 좁혀봅니다.
              </p>
            </div>
          </div>
          <button
            className="focus-ring motion-soft inline-flex min-h-11 w-fit items-center gap-2 rounded-control border border-rule bg-canvas px-3 text-xs font-bold text-ink-soft hover:border-accent-soft hover:bg-blush hover:text-accent"
            onClick={resetFilters}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
            초기화
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.25fr_0.95fr_0.95fr] xl:grid-cols-[1.35fr_0.9fr_0.9fr_0.85fr]">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-ink/50">
              검색
            </span>
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
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-ink/50">
              유형
            </span>
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
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-ink/50">
              이슈
            </span>
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
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-ink/50">
              인물
            </span>
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
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-y border-line py-3 text-sm font-bold text-ink/60">
        <span className="metric-tabular">표시 항목 {filteredItems.length}개</span>
        <span>최신순 정렬</span>
      </div>
      {leadItem ? (
        <div>
          <ItemCard item={leadItem} issues={issues} people={people} variant="lead" />
          {featuredItems.length > 0 ? (
            <div className="grid gap-0 border-b border-rule md:grid-cols-2 md:divide-x md:divide-line">
              {featuredItems.map((item) => (
                <div className="md:px-5 md:first:pl-0 md:last:pr-0" key={item.id}>
                  <ItemCard item={item} issues={issues} people={people} variant="compact" />
                </div>
              ))}
            </div>
          ) : null}
          {listItems.length > 0 ? (
            <div>
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
