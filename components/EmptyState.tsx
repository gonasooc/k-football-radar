type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({
  title,
  description = "필터를 넓히거나 다음 수집 실행 뒤 다시 확인하세요."
}: EmptyStateProps) {
  return (
    <div className="border-y border-line bg-paper px-5 py-8 text-center" role="status">
      <p className="text-sm font-black text-ink">{title}</p>
      <p className="mt-1 text-xs font-medium leading-5 text-ink-soft">{description}</p>
    </div>
  );
}
