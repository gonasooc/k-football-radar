export default function Loading() {
  return (
    <div
      aria-live="polite"
      className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
      role="status"
    >
      <p className="border-y border-rule py-5 text-sm font-black text-ink-soft">
        자료를 불러오는 중입니다.
      </p>
    </div>
  );
}
