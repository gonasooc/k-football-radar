"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Archive, Gauge, Newspaper, UserRoundSearch } from "lucide-react";

const navItems = [
  { href: "/", label: "대시보드", icon: Gauge },
  { href: "/feed", label: "피드", icon: Newspaper },
  { href: "/issues", label: "이슈", icon: Activity },
  { href: "/people", label: "인물", icon: UserRoundSearch },
  { href: "/sources", label: "출처", icon: Archive }
] as const;

function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="grid grid-cols-2 gap-2 lg:grid-cols-1" aria-label="주요 화면">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`focus-ring motion-soft inline-flex min-h-11 items-center gap-2 rounded-control border px-3 py-2 text-sm font-bold ${
              active
                ? "border-accent-soft bg-blush text-ink"
                : "border-line bg-panel text-ink-soft hover:border-accent-soft hover:bg-blush hover:text-ink"
            }`}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" className="size-4 text-accent" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
