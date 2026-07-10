"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-black tracking-[0.14em] text-accent">오류</p>
      <h1 className="mt-3 text-2xl font-black tracking-[-0.02em] text-ink sm:text-3xl">
        화면을 불러오지 못했습니다.
      </h1>
      <p className="mt-3 max-w-[65ch] text-sm font-medium leading-6 text-ink-soft">
        잠시 뒤 다시 시도해 주세요. 문제가 계속되면 홈 화면에서 다른 자료를 확인할
        수 있습니다.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          className="focus-ring motion-soft min-h-11 rounded-control bg-accent px-4 text-sm font-black text-canvas hover:bg-ink"
          onClick={reset}
          type="button"
        >
          다시 시도
        </button>
        <Link
          className="focus-ring motion-soft inline-flex min-h-11 items-center rounded-control border border-rule px-4 text-sm font-black text-ink hover:bg-paper"
          href="/"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}
