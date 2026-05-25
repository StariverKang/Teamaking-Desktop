import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "storage/**",
      "public/uploads/**",
      "local_bnbu_course_pipeline/**",
      "test*.mjs",
      "scripts/bnbu-crawler/test*.mjs"
    ]
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off"
    }
  }
];

export default config;
