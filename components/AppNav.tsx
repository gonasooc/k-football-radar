"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/", label: "프론트 페이지" },
  { href: "/feed", label: "전체 기사" },
  { href: "/issues", label: "이슈" },
  { href: "/people", label: "인물" },
  { href: "/sources", label: "출처" }
] as const;

function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();
  const [showStickyNav, setShowStickyNav] = useState(false);

  useEffect(() => {
    const updateStickyNav = () => {
      setShowStickyNav(window.scrollY > 180);
    };

    updateStickyNav();
    window.addEventListener("scroll", updateStickyNav, { passive: true });
    return () => window.removeEventListener("scroll", updateStickyNav);
  }, []);

  const links = navItems.map((item) => {
    const active = isActivePath(pathname, item.href);

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
    const active = isActivePath(pathname, item.href);

    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={`focus-ring motion-soft flex min-h-11 items-center justify-center border-t-2 px-1 text-center text-[11px] font-black leading-tight ${
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

  return (
    <>
      <nav
        className="-mx-4 overflow-x-auto border-t border-rule sm:mx-0"
        aria-label="주요 화면"
      >
        <div className="mx-auto flex min-h-11 w-full max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-8">
          {links}
        </div>
      </nav>

      <nav
        aria-label="고정 주요 화면"
        className={`fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-canvas px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-panel ${
          showStickyNav ? "block" : "hidden"
        }`}
      >
        <div className="mx-auto grid max-w-2xl grid-cols-5">{stickyLinks}</div>
      </nav>
    </>
  );
}
