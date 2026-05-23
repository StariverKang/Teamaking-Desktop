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
        ink: "#151713",
        paper: "#f5f1e8",
        chalk: "#fffdf6",
        forest: "#254536",
        rust: "#9b3f2f",
        graphite: "#5e625c",
        moss: "#254536",
        coral: "#9b3f2f",
        gold: "#b38b34",
        mist: "#e5e0d3"
      },
      boxShadow: {
        soft: "3px 3px 0 rgba(21, 23, 19, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
