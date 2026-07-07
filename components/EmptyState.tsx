import { SearchX } from "lucide-react";

export function EmptyState({ title }: { title: string }) {
  return (
    <div className="border border-dashed border-line bg-white/62 px-5 py-10 text-center">
      <SearchX aria-hidden="true" className="mx-auto size-8 text-ink/40" />
      <p className="mt-3 text-sm font-black text-ink">{title}</p>
    </div>
  );
}
