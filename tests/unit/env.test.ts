import { describe, expect, it } from "vitest";
import { getEnv } from "@/lib/env";

describe("getEnv", () => {
  it("lança erro com o nome da variável ausente", () => {
    expect(() => getEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("lança erro quando só a chave anon está ausente", () => {
    expect(() =>
      getEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("devolve as variáveis renomeadas quando presentes", () => {
    expect(
      getEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
      }),
    ).toEqual({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "k" });
  });
});
