import type { Metadata } from "next";
import Link from "next/link";
import { Radio } from "lucide-react";

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
        <div className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[248px_1fr]">
          <header className="border-b border-line bg-paper lg:min-h-screen lg:border-b-0 lg:border-r">
            <div className="flex h-full flex-col gap-5 px-4 py-4 lg:sticky lg:top-0 lg:px-5 lg:py-6">
              <Link className="group flex items-center gap-3 focus-ring" href="/">
                <span className="grid size-10 place-items-center rounded-control bg-accent text-xs font-black text-canvas">
                  KFR
                </span>
                <span>
                  <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-accent">
                    Korea Football Radar
                  </span>
                  <span className="mt-1 block text-lg font-black leading-tight text-ink">
                    한국축구 정보 레이더
                  </span>
                </span>
              </Link>

              <div className="flex items-start gap-2 rounded-panel border border-line bg-panel px-3 py-2 text-xs font-semibold leading-5 text-ink-soft">
                <Radio aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-accent" />
                <p>원문 링크 중심으로 뉴스와 공식자료를 추적합니다.</p>
              </div>

              <AppNav />

              <div className="mt-auto hidden border-t border-line pt-4 text-[11px] font-bold leading-5 text-muted lg:block">
                자동 태그는 키워드 기반입니다. 사실 판단은 원문에서 확인합니다.
              </div>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
