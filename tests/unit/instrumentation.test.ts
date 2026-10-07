import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "@/instrumentation";

describe("register (verificacao de ambiente no boot)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lanca erro nomeando a variavel ausente no runtime Node.js", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "k");
    await expect(register()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("nao faz nada quando as variaveis estao definidas", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "k");
    await expect(register()).resolves.toBeUndefined();
  });

  it("ignora runtimes que nao sao Node.js", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    await expect(register()).resolves.toBeUndefined();
  });
});
