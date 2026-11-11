import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { obterEstadoSessao, obterSessao } from "@/lib/supabase/session";

function dbComGetUser(resposta: { data: unknown; error: unknown }) {
  return { auth: { getUser: vi.fn().mockResolvedValue(resposta) } } as unknown as SupabaseClient;
}

function dbComPerfil(perfil: { data: unknown; error: unknown }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => perfil }) }),
    }),
  } as unknown as SupabaseClient;
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

  it("erro 4xx de auth (JWT de usuario removido) devolve sessao-invalida", async () => {
    const db = dbComGetUser({
      data: { user: null },
      error: { name: "AuthApiError", message: "invalid JWT", status: 403 },
    });
    expect(await obterEstadoSessao(db)).toEqual({ tipo: "sessao-invalida" });
  });

  it("429 e tratado como transitorio e lanca", async () => {
    const db = dbComGetUser({
      data: { user: null },
      error: { name: "AuthApiError", message: "rate limit", status: 429 },
    });
    await expect(obterEstadoSessao(db)).rejects.toThrow(/validar o usuario/);
  });

  it("erro sem status (rede) lanca com o detalhe e sem registrar (quem chama registra)", async () => {
    const db = dbComGetUser({
      data: { user: null },
      error: { name: "AuthRetryableFetchError", message: "fetch failed" },
    });
    await expect(obterEstadoSessao(db)).rejects.toThrow(/fetch failed/);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("erro na consulta de perfis lanca com o detalhe e sem registrar", async () => {
    const db = dbComPerfil({ data: null, error: { message: "boom" } });
    await expect(obterEstadoSessao(db)).rejects.toThrow(/perfil.*boom/);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("usuario sem perfil devolve sem-perfil", async () => {
    expect(await obterEstadoSessao(dbComPerfil({ data: null, error: null }))).toEqual({ tipo: "sem-perfil" });
  });
});

describe("obterSessao", () => {
  it("devolve null para sessao-invalida", async () => {
    const db = dbComGetUser({
      data: { user: null },
      error: { name: "AuthApiError", message: "invalid JWT", status: 401 },
    });
    expect(await obterSessao(db)).toBeNull();
  });

  it("devolve a sessao quando ha usuario e perfil", async () => {
    const db = dbComPerfil({ data: { empresa_id: "e1", papel: "admin" }, error: null });
    expect(await obterSessao(db)).toEqual({
      usuarioId: "u1",
      empresaId: "e1",
      papel: "admin",
      precisaTrocarSenha: false,
    });
  });

  it("marca precisaTrocarSenha quando o perfil tem o flag ligado", async () => {
    const db = dbComPerfil({
      data: { empresa_id: "e1", papel: "membro", precisa_trocar_senha: true },
      error: null,
    });
    expect(await obterSessao(db)).toEqual({
      usuarioId: "u1",
      empresaId: "e1",
      papel: "membro",
      precisaTrocarSenha: true,
    });
  });
});
