import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Archive, Gauge, Newspaper, UserRoundSearch } from "lucide-react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Korea Football Radar",
  description: "한국축구 이슈 뉴스와 공식자료 메타데이터를 모아 보는 정보 레이더"
};

const navItems = [
  { href: "/", label: "대시보드", icon: Gauge },
  { href: "/feed", label: "피드", icon: Newspaper },
  { href: "/issues", label: "이슈", icon: Activity },
  { href: "/people", label: "인물", icon: UserRoundSearch },
  { href: "/sources", label: "출처", icon: Archive }
] as const;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        <div className="min-h-screen">
          <header className="border-b border-line/90 bg-paper/92 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <Link className="group w-fit focus-ring" href="/">
                  <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-pine">
                    Korea Football Radar
                  </span>
                  <span className="mt-1 block text-2xl font-black text-ink sm:text-3xl">
                    한국축구 정보 레이더
                  </span>
                </Link>
                <p className="max-w-xl text-sm leading-6 text-ink/68">
                  뉴스와 공식자료의 메타데이터, 원문 링크, 자동 태그를 한 화면에서 확인합니다.
                </p>
              </div>
              <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="주요 화면">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      className="focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 border border-line bg-white/72 px-3 py-2 text-sm font-bold text-ink shadow-sm transition hover:border-pine hover:text-pine"
                      href={item.href}
                    >
                      <Icon aria-hidden="true" className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
