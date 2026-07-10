import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "oklch(20% 0.012 70)",
        "ink-soft": "oklch(38% 0.012 70)",
        summary: "oklch(48% 0.01 70)",
        muted: "oklch(50% 0.01 70)",
        canvas: "oklch(99% 0.003 80)",
        paper: "oklch(97% 0.004 80)",
        panel: "oklch(99.2% 0.002 80)",
        "panel-strong": "oklch(95.5% 0.005 80)",
        line: "oklch(89% 0.006 80)",
        rule: "oklch(83% 0.008 80)",
        accent: "oklch(52% 0.175 28)",
        blush: "oklch(97% 0.018 28)",
        "accent-soft": "oklch(88% 0.052 28)",
        official: "oklch(47% 0.105 155)",
        news: "oklch(45% 0.09 240)",
        warning: "oklch(62% 0.12 78)"
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
        panel: "0 18px 48px oklch(20% 0.012 70 / 0.055)",
        lift: "0 12px 28px oklch(20% 0.012 70 / 0.075)"
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
