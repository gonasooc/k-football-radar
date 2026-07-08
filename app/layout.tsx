import type { Metadata } from "next";
import Image from "next/image";
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
            <div className="mx-auto w-full max-w-7xl px-4 py-4 text-center sm:px-6 lg:px-8">
              <Link className="focus-ring block" href="/">
                <Image
                  alt="Korea Football Radar"
                  className="mx-auto h-auto w-full max-w-[720px]"
                  height={500}
                  priority
                  src="/brand/korea-football-radar-logo-header.png"
                  width={1830}
                />
                <span className="mx-auto mt-1 block w-fit max-w-full border-y border-line px-3 py-1.5 text-[13px] font-bold leading-6 text-ink-soft">
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
