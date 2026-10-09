import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { processarRequisicao, type AdaptadorCookies } from "@/lib/proxy/processar-requisicao";

type Opcoes = {
  usuario?: { id: string } | null;
  perfil?: { data: unknown; error: unknown };
  erroSignOut?: { message: string } | null;
  erroGetUser?: { name: string; message: string; status?: number };
  getUserLanca?: Error;
};

const COOKIE_RENOVADO = { name: "sb-token", value: "renovado", options: { path: "/" } };
const CABECALHOS_RENOVADOS = { "cache-control": "no-store" };

function montar(caminho: string, opcoes: Opcoes = {}) {
  const usuario = opcoes.usuario === undefined ? { id: "u1" } : opcoes.usuario;
  let adaptador!: AdaptadorCookies;
  const signOut = vi.fn(async () => {
    adaptador.setAll([{ name: "sb-token", value: "", options: { maxAge: 0 } }], CABECALHOS_RENOVADOS);
    return { error: opcoes.erroSignOut ?? null };
  });
  const db = {
    auth: {
      getUser: vi.fn(async () => {
        // Simula a renovacao do token feita pelo supabase/ssr durante getUser.
        adaptador.setAll([COOKIE_RENOVADO], CABECALHOS_RENOVADOS);
        if (opcoes.getUserLanca) throw opcoes.getUserLanca;
        if (opcoes.erroGetUser) return { data: { user: null }, error: opcoes.erroGetUser };
        return usuario
          ? { data: { user: usuario }, error: null }
          : { data: { user: null }, error: { name: "AuthSessionMissingError", message: "x" } };
      }),
      signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve(
              opcoes.perfil ?? { data: { empresa_id: "e1", papel: "admin" }, error: null },
            ),
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  const request = new NextRequest(`http://localhost:3000${caminho}`);
  const executar = () =>
    processarRequisicao(request, (cookies) => {
      adaptador = cookies;
      return db;
    });
  return { executar, signOut };
}

describe("processarRequisicao", () => {
  beforeEach(() => void vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("sessao valida segue adiante e copia cookies e headers renovados", async () => {
    const { executar, signOut } = montar("/dashboard");
    const resposta = await executar();
    expect(resposta.headers.get("location")).toBeNull();
    expect(resposta.headers.get("x-middleware-next")).toBe("1");
    expect(resposta.cookies.get("sb-token")?.value).toBe("renovado");
    expect(resposta.headers.get("cache-control")).toBe("no-store");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("sem perfil: signOut local e redireciona para /login?erro=sem-empresa com cookies e headers", async () => {
    const { executar, signOut } = montar("/dashboard", { perfil: { data: null, error: null } });
    const resposta = await executar();
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    expect(resposta.status).toBe(307);
    expect(new URL(resposta.headers.get("location")!).pathname + new URL(resposta.headers.get("location")!).search).toBe(
      "/login?erro=sem-empresa",
    );
    expect(resposta.cookies.get("sb-token")?.value).toBe("");
    expect(resposta.headers.get("cache-control")).toBe("no-store");
  });

  it("sem perfil e signOut falhando: registra o erro e ainda redireciona", async () => {
    const { executar } = montar("/dashboard", {
      perfil: { data: null, error: null },
      erroSignOut: { message: "falhou" },
    });
    const resposta = await executar();
    expect(resposta.status).toBe(307);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("sessao sem perfil"), "falhou");
  });

  it("erro na consulta de perfis redireciona para /login sem deslogar", async () => {
    const { executar, signOut } = montar("/dashboard", {
      perfil: { data: null, error: { message: "boom" } },
    });
    const resposta = await executar();
    expect(resposta.status).toBe(307);
    expect(new URL(resposta.headers.get("location")!).pathname).toBe("/login");
    expect(new URL(resposta.headers.get("location")!).search).toBe("");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("sem perfil ja em /login: nao redireciona (evita loop)", async () => {
    const { executar, signOut } = montar("/login", { perfil: { data: null, error: null } });
    const resposta = await executar();
    expect(resposta.headers.get("location")).toBeNull();
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  });

  it("sem sessao em rota protegida redireciona para /login", async () => {
    const { executar } = montar("/clientes", { usuario: null });
    const resposta = await executar();
    expect(new URL(resposta.headers.get("location")!).pathname).toBe("/login");
  });

  describe("troca de senha obrigatoria no primeiro acesso", () => {
    const precisaTrocar = {
      data: { empresa_id: "e1", papel: "membro", precisa_trocar_senha: true },
      error: null,
    };
    const caminhoDe = (r: Response) => new URL(r.headers.get("location")!).pathname;

    it("rota protegida redireciona para /definir-senha", async () => {
      const resposta = await montar("/dashboard", { perfil: precisaTrocar }).executar();
      expect(resposta.status).toBe(307);
      expect(caminhoDe(resposta)).toBe("/definir-senha");
      expect(resposta.cookies.get("sb-token")?.value).toBe("renovado");
    });

    it("/definir-senha segue adiante para quem precisa trocar", async () => {
      const resposta = await montar("/definir-senha", { perfil: precisaTrocar }).executar();
      expect(resposta.headers.get("location")).toBeNull();
    });

    it("quem nao precisa trocar e mandado de /definir-senha para /dashboard", async () => {
      const resposta = await montar("/definir-senha").executar();
      expect(caminhoDe(resposta)).toBe("/dashboard");
    });
  });

  it("sessao valida em /login redireciona para /dashboard", async () => {
    const { executar } = montar("/login");
    const resposta = await executar();
    expect(resposta.status).toBe(307);
    expect(new URL(resposta.headers.get("location")!).pathname).toBe("/dashboard");
    expect(resposta.cookies.get("sb-token")?.value).toBe("renovado");
  });

  describe("falhas de autenticacao em getUser", () => {
    const localDe = (resposta: Response) => {
      const url = new URL(resposta.headers.get("location")!);
      return url.pathname + url.search;
    };
    const erro401 = { name: "AuthApiError", message: "invalid JWT", status: 401 };

    it.each([
      ["JWT de usuario removido", { name: "AuthApiError", message: "User from sub claim in JWT does not exist", status: 403 }],
      ["refresh token invalido", { name: "AuthApiError", message: "Invalid Refresh Token", status: 400 }],
      ["token nao autorizado", erro401],
    ])("4xx (%s): signOut local, cookies e headers limpos, redireciona para /login", async (_nome, erroGetUser) => {
      const { executar, signOut } = montar("/dashboard", { erroGetUser });
      const resposta = await executar();
      expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
      expect(resposta.status).toBe(307);
      expect(localDe(resposta)).toBe("/login");
      expect(resposta.cookies.get("sb-token")?.value).toBe("");
      expect(resposta.headers.get("cache-control")).toBe("no-store");
    });

    it("4xx ja em /login: limpa a sessao e nao redireciona (evita loop)", async () => {
      const { executar, signOut } = montar("/login", { erroGetUser: erro401 });
      const resposta = await executar();
      expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
      expect(resposta.headers.get("location")).toBeNull();
    });

    it("4xx com signOut falhando: registra o erro e ainda redireciona", async () => {
      const { executar } = montar("/clientes", { erroGetUser: erro401, erroSignOut: { message: "falhou" } });
      const resposta = await executar();
      expect(resposta.status).toBe(307);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("sessao invalida"), "falhou");
    });

    it("429 (limite de taxa) e transitorio: nao desloga", async () => {
      const { executar, signOut } = montar("/dashboard", {
        erroGetUser: { name: "AuthApiError", message: "rate limit", status: 429 },
      });
      const resposta = await executar();
      expect(signOut).not.toHaveBeenCalled();
      expect(localDe(resposta)).toBe("/login");
    });

    it("5xx: falha fechada, redireciona para /login sem deslogar e registra uma vez", async () => {
      const { executar, signOut } = montar("/dashboard", {
        erroGetUser: { name: "AuthRetryableFetchError", message: "indisponivel", status: 503 },
      });
      const resposta = await executar();
      expect(signOut).not.toHaveBeenCalled();
      expect(localDe(resposta)).toBe("/login");
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("erro de rede sem status: nao desloga", async () => {
      const { executar, signOut } = montar("/dashboard", {
        erroGetUser: { name: "AuthRetryableFetchError", message: "fetch failed" },
      });
      const resposta = await executar();
      expect(signOut).not.toHaveBeenCalled();
      expect(localDe(resposta)).toBe("/login");
    });

    it("getUser lancando excecao inesperada: falha fechada, sem signOut, registrado uma vez", async () => {
      const { executar, signOut } = montar("/dashboard", { getUserLanca: new Error("explodiu") });
      const resposta = await executar();
      expect(signOut).not.toHaveBeenCalled();
      expect(localDe(resposta)).toBe("/login");
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(expect.any(String), "explodiu");
    });

    it("erro na consulta de perfis e registrado uma unica vez", async () => {
      const { executar } = montar("/dashboard", { perfil: { data: null, error: { message: "boom" } } });
      await executar();
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });
});
