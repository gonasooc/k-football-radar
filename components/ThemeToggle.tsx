"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

// Approximate hex of the --canvas token per theme, for the mobile browser chrome
// tint (<meta name="theme-color">), which does not reliably accept oklch().
const THEME_COLOR: Record<Theme, string> = {
  light: "#fdfbf7",
  dark: "#211f1b"
};

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[theme]);
}

export function ThemeToggle() {
  // Null until mounted so server and first client render match (the real theme
  // is set on <html> by the pre-paint script in the layout).
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  function toggle(): void {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;

    if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      root.classList.add("theme-transition");
      window.setTimeout(() => root.classList.remove("theme-transition"), 240);
    }

    applyTheme(next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Ignore storage failures (private mode, storage disabled).
    }
    setTheme(next);
  }

  const isDark = theme === "dark";
  const label = isDark ? "라이트 모드로 전환" : "다크 모드로 전환";

  return (
    <button
      aria-label={label}
      className="focus-ring motion-soft inline-flex size-8 shrink-0 items-center justify-center rounded-control border border-rule text-ink-soft hover:border-ink hover:text-ink sm:size-10"
      onClick={toggle}
      title={label}
      type="button"
    >
      {theme === null ? (
        <span aria-hidden="true" className="size-4 sm:size-[18px]" />
      ) : isDark ? (
        <Sun aria-hidden="true" className="size-4 sm:size-[18px]" strokeWidth={1.9} />
      ) : (
        <Moon aria-hidden="true" className="size-4 sm:size-[18px]" strokeWidth={1.9} />
      )}
    </button>
  );
}
