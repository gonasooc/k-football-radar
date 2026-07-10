import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없음"
};

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-black tracking-[0.14em] text-accent">404</p>
      <h1 className="mt-3 text-2xl font-black tracking-[-0.02em] text-ink sm:text-3xl">
        요청한 화면을 찾을 수 없습니다.
      </h1>
      <p className="mt-3 max-w-[65ch] text-sm font-medium leading-6 text-ink-soft">
        주소가 바뀌었거나 공개되지 않은 이슈·인물일 수 있습니다.
      </p>
      <Link
        className="focus-ring motion-soft mt-6 inline-flex min-h-11 items-center rounded-control border border-rule px-4 text-sm font-black text-ink hover:border-accent-soft hover:bg-blush hover:text-accent"
        href="/"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
