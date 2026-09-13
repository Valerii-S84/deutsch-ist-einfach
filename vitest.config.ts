import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  oxc: false,
  esbuild: {
    jsx: "automatic",
  } as never,
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "**/.verification/**"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
