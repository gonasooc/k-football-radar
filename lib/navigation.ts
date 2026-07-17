export type NavItem = {
  href: string;
  label: string;
  activePatterns?: readonly string[];
};

export type TrackingTabId = "issues" | "people";

export type TrackingTab = {
  id: TrackingTabId;
  href: string;
  label: string;
};

export const navItems: readonly NavItem[] = [
  { href: "/", label: "홈" },
  { href: "/news", label: "뉴스" },
  { href: "/youtube", label: "유튜브" },
  {
    href: "/tracking",
    label: "트래킹",
    activePatterns: ["/tracking", "/issues", "/people"]
  },
  { href: "/sources", label: "출처" }
] as const;

export const trackingTabs = [
  { id: "issues", label: "이슈", href: "/tracking" },
  { id: "people", label: "인물", href: "/tracking?tab=people" }
] as const satisfies readonly TrackingTab[];

function stripQuery(pathname: string): string {
  return pathname.split("?")[0] || "/";
}

function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function getActiveNavItem(pathname: string): NavItem | undefined {
  const normalizedPathname = stripQuery(pathname);

  return navItems.find((item) =>
    (item.activePatterns ?? [item.href]).some((pattern) =>
      isActivePath(normalizedPathname, pattern)
    )
  );
}

export function getTrackingTabFromSearchParams(
  searchParams?: Record<string, string | string[] | undefined>
): TrackingTabId {
  const tab = searchParams?.tab;
  const value = Array.isArray(tab) ? tab[0] : tab;

  return value === "people" ? "people" : "issues";
}
