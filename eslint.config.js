import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.agents/**", "**/nultra-mvp-prd/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts", "tests/**/*.ts", "*.config.ts", "*.config.js"],
  },
);