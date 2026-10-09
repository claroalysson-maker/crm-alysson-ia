import { beforeEach, describe, expect, it, vi } from "vitest";

const updateUser = vi.fn();
const rpc = vi.fn();
const criarCliente = vi.fn();
const redirecionar = vi.fn((destino: string) => {
  throw new Error(`REDIRECT:${destino}`);
});

vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => criarCliente() }));
vi.mock("next/navigation", () => ({ redirect: (d: string) => redirecionar(d) }));

import { definirSenha } from "@/app/definir-senha/actions";
import {
  ERRO_FALHA_TEMPORARIA,
  ERRO_SENHA_FRACA,
  ERRO_SENHA_IGUAL,
  ERRO_TROCA_INCOMPLETA,
} from "@/lib/senha-schema";

function form(senha: string, confirmacao: string) {
  const f = new FormData();
  f.set("senha", senha);
  f.set("confirmacao", confirmacao);
  return f;
}

function clienteCom(perfil: unknown = { empresa_id: "e1", papel: "membro", precisa_trocar_senha: true }) {
  return {
    auth: {
      updateUser,
      getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
    },
    rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: perfil, error: null }) }) }),
    }),
  };
}

describe("definirSenha (server action)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateUser.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ error: null });
    criarCliente.mockImplementation(() => clienteCom());
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("validacao falha: devolve a mensagem e nao altera nada", async () => {
    const r = await definirSenha({}, form("curta", "curta"));
    expect(r.erro).toBe("A senha deve ter pelo menos 8 caracteres");
    expect(updateUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("confirmacao diferente: nao altera nada", async () => {
    const r = await definirSenha({}, form("umaSenhaBoa1", "outraSenha12"));
    expect(r.erro).toBe("As senhas não conferem");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("sucesso: troca a senha, conclui a troca e vai para /dashboard", async () => {
    await expect(definirSenha({}, form("umaSenhaBoa1", "umaSenhaBoa1"))).rejects.toThrow("REDIRECT:/dashboard");
    expect(updateUser).toHaveBeenCalledWith({ password: "umaSenhaBoa1" });
    expect(rpc).toHaveBeenCalledWith("concluir_troca_senha");
    expect(updateUser.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
  });

  it("usuario que nao precisa trocar e redirecionado sem alterar a senha", async () => {
    criarCliente.mockImplementation(() => clienteCom({ empresa_id: "e1", papel: "admin", precisa_trocar_senha: false }));
    await expect(definirSenha({}, form("umaSenhaBoa1", "umaSenhaBoa1"))).rejects.toThrow("REDIRECT:/dashboard");
    expect(updateUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sem sessao valida vai para /login sem alterar a senha", async () => {
    criarCliente.mockImplementation(() => clienteCom(null));
    await expect(definirSenha({}, form("umaSenhaBoa1", "umaSenhaBoa1"))).rejects.toThrow("REDIRECT:/login");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("senha igual a atual: mensagem propria e nao conclui a troca", async () => {
    updateUser.mockResolvedValue({ error: { code: "same_password", message: "x" } });
    const r = await definirSenha({}, form("umaSenhaBoa1", "umaSenhaBoa1"));
    expect(r.erro).toBe(ERRO_SENHA_IGUAL);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("senha fraca segundo o Auth: mensagem propria e nao conclui a troca", async () => {
    updateUser.mockResolvedValue({ error: { code: "weak_password", message: "x" } });
    const r = await definirSenha({}, form("umaSenhaBoa1", "umaSenhaBoa1"));
    expect(r.erro).toBe(ERRO_SENHA_FRACA);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("falha tecnica no updateUser: mensagem generica e nao conclui a troca", async () => {
    updateUser.mockResolvedValue({ error: { code: "unexpected_failure", message: "boom", status: 500 } });
    const r = await definirSenha({}, form("umaSenhaBoa1", "umaSenhaBoa1"));
    expect(r.erro).toBe(ERRO_FALHA_TEMPORARIA);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("falha ao concluir a troca depois de alterar a senha: avisa e nao redireciona", async () => {
    rpc.mockResolvedValue({ error: { message: "rpc falhou" } });
    const r = await definirSenha({}, form("umaSenhaBoa1", "umaSenhaBoa1"));
    expect(r.erro).toBe(ERRO_TROCA_INCOMPLETA);
    expect(redirecionar).not.toHaveBeenCalled();
  });

  it("excecao inesperada devolve mensagem generica", async () => {
    criarCliente.mockImplementation(() => {
      throw new Error("sem cookies");
    });
    const r = await definirSenha({}, form("umaSenhaBoa1", "umaSenhaBoa1"));
    expect(r.erro).toBe(ERRO_FALHA_TEMPORARIA);
  });
});
