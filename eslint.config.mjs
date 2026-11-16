import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Which folder may import which (see CLAUDE.md "Repo layout"):
//   shared/  → nothing else      backend/ → shared/      web/ → backend/, shared/
// mobile/ has its own ESLint setup and is ignored here.
const noImport = (patterns, message) => ({
  "no-restricted-imports": ["error", { patterns: [{ group: patterns, message }] }],
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { settings: { next: { rootDir: "web/" } } },
  {
    files: ["shared/**"],
    rules: noImport(["@/*", "@backend/*", "**/web/**", "**/backend/**", "**/mobile/**", "react", "next", "next/*", "@prisma/*"],
      "shared/ is plain code for web, backend and mobile: no web, backend, React, Next or database imports."),
  },
  {
    files: ["backend/**"],
    rules: noImport(["@/*", "**/web/**", "**/mobile/**"], "backend/ must not import web/ or mobile/ code."),
  },
  {
    files: ["web/**"],
    rules: noImport(["**/mobile/**"], "web/ must not import mobile/ code."),
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    "web/.next/**",
    "web/out/**",
    "web/build/**",
    "web/next-env.d.ts",
    "mobile/**",
  ]),
]);

export default eslintConfig;
