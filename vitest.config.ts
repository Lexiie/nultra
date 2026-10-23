import { defineConfig } from "vitest/config";

import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@nultra/shared-types": resolve(__dirname, "packages/shared-types/src/index.ts"),
      "@nultra/strike-client": resolve(__dirname, "packages/strike-client/src/index.ts"),
      "@nultra/data-core": resolve(__dirname, "packages/data-core/src/index.ts"),
      "@nultra/quant-core": resolve(__dirname, "packages/quant-core/src/index.ts"),
      "@nultra/validation": resolve(__dirname, "packages/validation/src/index.ts"),
    },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
