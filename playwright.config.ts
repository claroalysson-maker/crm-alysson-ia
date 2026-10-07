import { defineConfig, devices } from "@playwright/test";

const PORTA = 3100;
const URL_BASE = `http://localhost:${PORTA}`;

// NEXT_PUBLIC_* sao embutidas no build: precisam estar no ambiente deste comando.
for (const nome of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
  if (!process.env[nome]) {
    throw new Error(`Defina ${nome} no ambiente para rodar os testes E2E (o build a embute).`);
  }
}

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  expect: { timeout: 10_000 },
  reporter: "list",
  globalSetup: "./tests/e2e/setup.ts",
  globalTeardown: "./tests/e2e/teardown.ts",
  use: {
    baseURL: URL_BASE,
    locale: "pt-BR",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORTA}`,
    url: `${URL_BASE}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
