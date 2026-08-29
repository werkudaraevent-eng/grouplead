import { defineConfig } from "vitest/config"
import path from "path"

/**
 * Mirrors LeadEngine's setup so tests read the same way in both apps.
 *
 * The alias matters: `@/*` resolves to the app root in tsconfig, and without
 * repeating it here any test importing through the alias fails to resolve even
 * though the same import type-checks and builds.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
