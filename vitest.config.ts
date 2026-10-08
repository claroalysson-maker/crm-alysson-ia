import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: [
        "src/components/ui/**", // shadcn gerado
        "**/*.d.ts",
        "**/*.css",
      ],
      // Limiar minimo do projeto (nao reduzir): vale em `npm run test:coverage`.
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
