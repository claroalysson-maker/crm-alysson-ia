import { defineConfig } from "vitest/config";
import path from "node:path";

// Testes de integracao: usam o projeto Supabase real (credenciais em
// .env.test.local, carregado por tests/integration/helpers.ts).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
