import type { Metadata } from "next";
import Link from "next/link";

import { AppNav } from "@/components/AppNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Korea Football Radar",
  description: "한국축구 이슈 뉴스와 공식자료 메타데이터를 모아 보는 정보 레이더"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        <div className="min-h-screen bg-canvas text-ink">
          <header className="border-b border-rule bg-canvas">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-2 text-[11px] font-bold text-muted sm:px-6 lg:px-8">
              <span>Source-first Korean football governance monitor</span>
              <span className="hidden sm:inline">Original links remain visible on every item</span>
            </div>

            <div className="mx-auto w-full max-w-7xl px-4 py-5 text-center sm:px-6 lg:px-8">
              <Link className="focus-ring inline-block" href="/">
                <span className="block font-serif text-[2rem] font-black leading-none text-ink sm:text-[3.4rem]">
                  Korea Football Radar
                </span>
                <span className="mt-2 block text-[12px] font-black uppercase tracking-[0.2em] text-accent">
                  한국축구 이슈와 공식자료를 모아 보는 편집 데스크
                </span>
              </Link>
            </div>

            <AppNav />
          </header>
          <main className="pb-20">{children}</main>
        </div>
      </body>
    </html>
  );
}
