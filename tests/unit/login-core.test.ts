import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { autenticar, ERRO_FALHA_TEMPORARIA } from "@/lib/login";

type Resp = { data?: unknown; error: unknown };

function dbFalso(opcoes: { login: Resp; usuario?: Resp; perfil?: Resp }) {
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const db = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue(opcoes.login),
      getUser: vi.fn().mockResolvedValue(opcoes.usuario ?? { data: { user: { id: "u1" } }, error: null }),
      signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve(opcoes.perfil ?? { data: null, error: null }) }),
      }),
    }),
  } as unknown as SupabaseClient;
  return { db, signOut };
}

describe("autenticar com falhas tecnicas", () => {
  beforeEach(() => void vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("erro 500/rede devolve mensagem amigavel, nao a de credenciais, e nao desloga", async () => {
    const { db, signOut } = dbFalso({
      login: { error: { name: "AuthRetryableFetchError", message: "fetch failed", status: 0 } },
    });
    expect(await autenticar(db, "a@b.com", "segredo")).toEqual({ erro: ERRO_FALHA_TEMPORARIA });
    expect(signOut).not.toHaveBeenCalled();
    expect(JSON.stringify((console.error as ReturnType<typeof vi.fn>).mock.calls)).not.toContain("segredo");
  });

  it("email_not_confirmed usa a mensagem de credenciais", async () => {
    const { db } = dbFalso({ login: { error: { code: "email_not_confirmed", message: "x" } } });
    expect(await autenticar(db, "a@b.com", "s")).toEqual({ erro: "E-mail ou senha incorretos" });
  });

  it("falha na consulta de perfis devolve mensagem amigavel, sem deslogar", async () => {
    const { db, signOut } = dbFalso({
      login: { error: null },
      perfil: { data: null, error: { message: "boom" } },
    });
    expect(await autenticar(db, "a@b.com", "s")).toEqual({ erro: ERRO_FALHA_TEMPORARIA });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("erro transitorio em getUser apos o login nao vira conta sem empresa nem desloga", async () => {
    const { db, signOut } = dbFalso({
      login: { error: null },
      usuario: { data: { user: null }, error: { name: "AuthRetryableFetchError", message: "503", status: 503 } },
    });
    expect(await autenticar(db, "a@b.com", "s")).toEqual({ erro: ERRO_FALHA_TEMPORARIA });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("sem perfil (consulta ok) desloga e informa conta nao vinculada", async () => {
    const { db, signOut } = dbFalso({ login: { error: null } });
    expect(await autenticar(db, "a@b.com", "s")).toEqual({
      erro: "Sua conta não está vinculada a uma empresa",
    });
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  });

  it("sem perfil e signOut falhando: registra o erro e ainda informa conta nao vinculada", async () => {
    const { db, signOut } = dbFalso({ login: { error: null } });
    signOut.mockResolvedValue({ error: { message: "falhou" } });
    expect(await autenticar(db, "a@b.com", "s")).toEqual({
      erro: "Sua conta não está vinculada a uma empresa",
    });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("sem perfil"), "falhou");
  });

  it.each([
    ["sem-usuario", { data: { user: null }, error: { name: "AuthSessionMissingError", message: "x" } }],
    ["sessao-invalida", { data: { user: null }, error: { name: "AuthApiError", message: "jwt", status: 403 } }],
  ])("estado %s apos o login nao vira conta sem empresa: mensagem amigavel e signOut local", async (_n, usuario) => {
    const { db, signOut } = dbFalso({ login: { error: null }, usuario });
    expect(await autenticar(db, "a@b.com", "s")).toEqual({ erro: ERRO_FALHA_TEMPORARIA });
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  });
});

describe("erroDaUrl", () => {
  it("aceita apenas o valor conhecido", async () => {
    const { erroDaUrl, ERRO_SEM_EMPRESA } = await import("@/lib/login");
    expect(erroDaUrl("sem-empresa")).toBe(ERRO_SEM_EMPRESA);
    expect(erroDaUrl("<script>")).toBeUndefined();
    expect(erroDaUrl("constructor")).toBeUndefined();
    expect(erroDaUrl(["sem-empresa"])).toBeUndefined();
    expect(erroDaUrl(undefined)).toBeUndefined();
  });
});
