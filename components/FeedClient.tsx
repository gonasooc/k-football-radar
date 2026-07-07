"use client";

import { Search } from "lucide-react";
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

  return (
    <div className="space-y-5">
      <div className="border border-line bg-white/82 p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-ink/55">
              검색
            </span>
            <span className="relative block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/45"
              />
              <input
                className="focus-ring h-11 w-full border-line bg-paper pl-10 text-sm font-semibold text-ink placeholder:text-ink/38"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="제목, 출처, 키워드"
                type="search"
                value={query}
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-ink/55">
              유형
            </span>
            <select
              className="focus-ring h-11 w-full border-line bg-paper text-sm font-bold text-ink"
              onChange={(event) => setTypeFilter(event.target.value as FeedTypeFilter)}
              value={typeFilter}
            >
              <option value="all">전체</option>
              <option value="news">뉴스</option>
              <option value="official">공식자료</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-ink/55">
              이슈
            </span>
            <select
              className="focus-ring h-11 w-full border-line bg-paper text-sm font-bold text-ink"
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
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-ink/55">
              인물
            </span>
            <select
              className="focus-ring h-11 w-full border-line bg-paper text-sm font-bold text-ink"
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
      <div className="flex items-center justify-between gap-3 text-sm font-bold text-ink/62">
        <span>표시 항목 {filteredItems.length}개</span>
        <span>최신순</span>
      </div>
      {filteredItems.length > 0 ? (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <ItemCard item={item} issues={issues} key={item.id} people={people} />
          ))}
        </div>
      ) : (
        <EmptyState title="조건에 맞는 수집 항목이 없습니다." />
      )}
    </div>
  );
}
