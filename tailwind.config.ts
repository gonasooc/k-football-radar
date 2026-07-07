import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1d2329",
        paper: "#f7f4ee",
        fog: "#e7e1d7",
        line: "#d7cec1",
        pine: "#14634f",
        signal: "#c94b35",
        brass: "#b4822f",
        harbor: "#246a8d"
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "SUIT",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "sans-serif"
        ]
      },
      boxShadow: {
        panel: "0 18px 60px rgb(29 35 41 / 0.08)"
      }
    }
  },
  plugins: [forms]
};

export default config;
