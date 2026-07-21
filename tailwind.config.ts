import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

// Colors are driven by CSS custom properties (see app/globals.css) so the whole
// palette can flip between light and dark themes. Each variable holds a bare
// `L C H` triplet; wrapping it in oklch(... / <alpha-value>) keeps Tailwind's
// opacity modifiers (e.g. bg-ink/90) working.
function themed(variable: string): string {
  return `oklch(var(${variable}) / <alpha-value>)`;
}

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: themed("--ink"),
        "ink-soft": themed("--ink-soft"),
        summary: themed("--summary"),
        muted: themed("--muted"),
        canvas: themed("--canvas"),
        paper: themed("--paper"),
        panel: themed("--panel"),
        "panel-strong": themed("--panel-strong"),
        line: themed("--line"),
        rule: themed("--rule"),
        accent: themed("--accent"),
        blush: themed("--blush"),
        "accent-soft": themed("--accent-soft"),
        official: themed("--official"),
        news: themed("--news"),
        warning: themed("--warning")
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "Apple SD Gothic Neo",
          "Noto Sans KR",
          "Segoe UI",
          "sans-serif"
        ]
      },
      boxShadow: {
        panel: "0 18px 48px oklch(var(--shadow) / 0.055)",
        lift: "0 12px 28px oklch(var(--shadow) / 0.075)"
      },
      borderRadius: {
        chip: "3px",
        control: "4px",
        panel: "6px"
      }
    }
  },
  plugins: [forms]
};

export default config;
