import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#11130f",
        paper: "#f2ecdf",
        chalk: "#fbf7ed",
        forest: "#233d31",
        rust: "#8f382b",
        graphite: "#5f5c54",
        moss: "#233d31",
        coral: "#8f382b",
        gold: "#9f7e36",
        mist: "#e0d7c7"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Georgia", "Times New Roman", "Times", "ui-serif", "serif"]
      },
      boxShadow: {
        soft: "1px 1px 0 rgba(17, 19, 15, 0.18)",
        hard: "2px 2px 0 rgba(17, 19, 15, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;
