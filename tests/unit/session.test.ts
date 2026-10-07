import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { obterEstadoSessao } from "@/lib/supabase/session";

function dbComGetUser(resposta: { data: unknown; error: unknown }) {
  return { auth: { getUser: vi.fn().mockResolvedValue(resposta) } } as unknown as SupabaseClient;
}

describe("obterEstadoSessao e erros de getUser", () => {
  beforeEach(() => void vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("sessao ausente (AuthSessionMissingError) devolve sem-usuario", async () => {
    const db = dbComGetUser({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
    });
    expect(await obterEstadoSessao(db)).toEqual({ tipo: "sem-usuario" });
  });

  it("erro transitorio (rede/5xx) lanca em vez de virar sem-usuario", async () => {
    const db = dbComGetUser({
      data: { user: null },
      error: { name: "AuthRetryableFetchError", message: "fetch failed", status: 503 },
    });
    await expect(obterEstadoSessao(db)).rejects.toThrow(/validar o usuario/);
  });
});
