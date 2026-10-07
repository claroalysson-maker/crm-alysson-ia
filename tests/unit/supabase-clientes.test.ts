import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const criarClienteSSR = vi.fn();
const criarClienteNavegador = vi.fn();
const processarRequisicao = vi.fn();
const armazenamento = { getAll: vi.fn(), set: vi.fn() };

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...a: unknown[]) => criarClienteSSR(...a),
  createBrowserClient: (...a: unknown[]) => criarClienteNavegador(...a),
}));
vi.mock("next/headers", () => ({ cookies: async () => armazenamento }));
vi.mock("@/lib/proxy/processar-requisicao", () => ({
  processarRequisicao: (...a: unknown[]) => processarRequisicao(...a),
}));

import { proxy } from "@/proxy";
import { createBrowserClient } from "@/lib/supabase/browser";
import { createServerClient } from "@/lib/supabase/server";

const URL_SUPABASE = "https://exemplo.supabase.test";
const CHAVE_ANON = "chave-anonima-de-teste";

describe("clientes Supabase e proxy (fiacao)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_SUPABASE);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", CHAVE_ANON);
    criarClienteSSR.mockReset().mockReturnValue({ marca: "cliente" });
    criarClienteNavegador.mockReset().mockReturnValue({ marca: "navegador" });
    processarRequisicao.mockReset();
    armazenamento.getAll.mockReset().mockReturnValue([{ name: "a", value: "1" }]);
    armazenamento.set.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  describe("createServerClient", () => {
    it("cria o cliente SSR com URL/chave do ambiente e cookies do next/headers", async () => {
      expect(await createServerClient()).toEqual({ marca: "cliente" });
      const [url, chave, { cookies }] = criarClienteSSR.mock.calls[0];
      expect([url, chave]).toEqual([URL_SUPABASE, CHAVE_ANON]);
      expect(cookies.getAll()).toEqual([{ name: "a", value: "1" }]);
    });

    it("setAll grava cada cookie com suas opcoes", async () => {
      await createServerClient();
      const { cookies } = criarClienteSSR.mock.calls[0][2];
      cookies.setAll([{ name: "sb", value: "v", options: { path: "/" } }]);
      expect(armazenamento.set).toHaveBeenCalledExactlyOnceWith("sb", "v", { path: "/" });
    });

    it("setAll ignora a falha de escrita de cookies em Server Components", async () => {
      armazenamento.set.mockImplementation(() => {
        throw new Error("somente leitura");
      });
      await createServerClient();
      const { cookies } = criarClienteSSR.mock.calls[0][2];
      expect(() => cookies.setAll([{ name: "sb", value: "v" }])).not.toThrow();
    });

    it("falha se o ambiente nao esta configurado", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
      await expect(createServerClient()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    });
  });

  describe("createBrowserClient", () => {
    it("cria o cliente de navegador com URL e chave publicas", () => {
      expect(createBrowserClient()).toEqual({ marca: "navegador" });
      expect(criarClienteNavegador).toHaveBeenCalledExactlyOnceWith(URL_SUPABASE, CHAVE_ANON);
    });
  });

  describe("proxy", () => {
    it("delega a processarRequisicao criando o cliente SSR com o adaptador de cookies recebido", async () => {
      const resposta = { marca: "resposta" };
      processarRequisicao.mockResolvedValue(resposta);
      const request = { marca: "request" };

      expect(await proxy(request as never)).toBe(resposta);

      const [recebida, criar] = processarRequisicao.mock.calls[0];
      expect(recebida).toBe(request);
      const adaptador = { getAll: () => [], setAll: () => {} };
      expect(criar(adaptador)).toEqual({ marca: "cliente" });
      expect(criarClienteSSR).toHaveBeenCalledExactlyOnceWith(URL_SUPABASE, CHAVE_ANON, { cookies: adaptador });
    });
  });
});
