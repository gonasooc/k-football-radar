"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, Radio, ScanSearch } from "lucide-react";

import { getActiveNavItem, navItems } from "@/lib/navigation";

export function AppNav() {
  const pathname = usePathname();
  const activeNavItem = getActiveNavItem(pathname);

  const links = navItems.map((item) => {
    const active = activeNavItem?.href === item.href;

    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={`focus-ring motion-soft inline-flex min-h-11 shrink-0 items-center border-b-2 pt-0.5 text-[13px] font-black tracking-[0.02em] ${
          active
            ? "border-accent text-ink"
            : "border-transparent text-ink-soft hover:border-rule hover:text-ink"
        }`}
        href={item.href}
        key={item.href}
      >
        {item.label}
      </Link>
    );
  });

  const stickyLinks = navItems.map((item) => {
    const active = activeNavItem?.href === item.href;
    const Icon = item.href === "/" ? Radio : item.href === "/tracking" ? ScanSearch : Archive;

    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={`focus-ring motion-soft flex min-h-12 flex-col items-center justify-center gap-1 border-t-2 px-1 text-center text-[10px] font-black leading-tight ${
          active
            ? "border-accent text-ink"
            : "border-transparent text-ink-soft hover:border-rule hover:text-ink"
        }`}
        href={item.href}
        key={item.href}
      >
        <Icon aria-hidden="true" className="size-4" strokeWidth={active ? 2.5 : 1.8} />
        {item.label}
      </Link>
    );
  });

  return (
    <>
      <nav
        className="hidden overflow-x-auto border-t border-rule sm:block"
        aria-label="주요 화면"
      >
        <div className="mx-auto flex min-h-11 w-full max-w-7xl items-center gap-5 sm:px-6 lg:px-8">
          {links}
        </div>
      </nav>

      <nav
        aria-label="고정 주요 화면"
        className="fixed inset-x-0 bottom-0 z-50 block border-t border-rule bg-canvas/95 px-3 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-1 shadow-panel sm:hidden"
      >
        <div className="mx-auto grid max-w-xl grid-cols-3">{stickyLinks}</div>
      </nav>
    </>
  );
}
