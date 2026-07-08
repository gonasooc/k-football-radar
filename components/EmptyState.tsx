import { SearchX } from "lucide-react";

export function EmptyState({ title }: { title: string }) {
  return (
    <div className="rounded-panel border border-dashed border-accent-soft bg-panel px-5 py-10 text-center">
      <SearchX aria-hidden="true" className="mx-auto size-8 text-accent" />
      <p className="mt-3 text-sm font-black text-ink">{title}</p>
      <p className="mt-2 text-xs font-medium text-muted">
        필터를 넓히거나 다음 수집 실행 뒤 다시 확인하세요.
      </p>
    </div>
  );
}
