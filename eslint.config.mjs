import nextTs from "eslint-config-next/typescript";
import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "coverage/**", "node_modules/**"],
  },
];

export default config;
