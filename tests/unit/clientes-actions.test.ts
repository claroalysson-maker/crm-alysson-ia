import { beforeEach, describe, expect, it, vi } from "vitest";

const criarCliente = vi.fn();
const atualizarCliente = vi.fn();
const excluirCliente = vi.fn();
const revalidatePath = vi.fn();
const db = { marca: "db" };

vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => db }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("@/lib/clientes/repositorio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/clientes/repositorio")>()),
  criarCliente: (...a: unknown[]) => criarCliente(...a),
  atualizarCliente: (...a: unknown[]) => atualizarCliente(...a),
  excluirCliente: (...a: unknown[]) => excluirCliente(...a),
}));

import { removerCliente, salvarCliente } from "@/app/(app)/clientes/actions";

const ID = "7b0f5a2e-3c1d-4f6a-9b8e-1a2b3c4d5e6f";

function form(campos: Record<string, string>) {
  const f = new FormData();
  Object.entries(campos).forEach(([k, v]) => f.set(k, v));
  return f;
}
const valido = { nome: "Ana", email: "ana@x.com", status: "lead", valor_estimado: "1500.50" };

describe("salvarCliente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    criarCliente.mockResolvedValue({});
    atualizarCliente.mockResolvedValue({});
  });

  it("dados invalidos devolvem erros por campo e nao chamam o repositorio", async () => {
    const r = await salvarCliente(
      {},
      form({ nome: "  ", email: "xx", status: "foo", valor_estimado: "1" }),
    );
    expect(r.ok).toBeUndefined();
    expect(r.erros).toMatchObject({
      nome: "Informe o nome",
      email: "Informe um e-mail válido",
      status: "Selecione um status válido",
    });
    expect(criarCliente).not.toHaveBeenCalled();
    expect(atualizarCliente).not.toHaveBeenCalled();
  });

  it("devolve os valores digitados para repreencher o formulario", async () => {
    const r = await salvarCliente({}, form({ ...valido, nome: "", telefone: "123" }));
    expect(r.valores?.telefone).toBe("123");
    expect(r.valores?.email).toBe("ana@x.com");
  });

  it.each(["10.123", "10,123", "1.5555"])(
    "valor %s mostra mensagem de casas decimais",
    async (valor) => {
      const r = await salvarCliente({}, form({ ...valido, valor_estimado: valor }));
      expect(r.erros?.valor_estimado).toBe("Use no máximo 2 casas decimais");
      expect(criarCliente).not.toHaveBeenCalled();
    },
  );

  it("valor nao numerico mostra mensagem propria", async () => {
    const r = await salvarCliente({}, form({ ...valido, valor_estimado: "abc" }));
    expect(r.erros?.valor_estimado).toBe("Informe um valor válido, como 1500,50");
  });

  it("aceita virgula decimal", async () => {
    const r = await salvarCliente({}, form({ ...valido, valor_estimado: "1500,5" }));
    expect(r).toEqual({ ok: true });
    expect(criarCliente.mock.calls[0][1].valor_estimado).toBe(1500.5);
  });

  it("sem id cria o cliente e revalida as telas", async () => {
    const r = await salvarCliente({}, form(valido));
    expect(r).toEqual({ ok: true });
    expect(criarCliente).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ nome: "Ana", status: "lead" }),
    );
    expect(atualizarCliente).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/clientes");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("com id atualiza o cliente", async () => {
    const r = await salvarCliente({}, form({ ...valido, id: ID }));
    expect(r).toEqual({ ok: true });
    expect(atualizarCliente).toHaveBeenCalledWith(
      db,
      ID,
      expect.objectContaining({ nome: "Ana" }),
    );
    expect(criarCliente).not.toHaveBeenCalled();
  });

  it("id que nao e UUID e rejeitado sem chamar o repositorio", async () => {
    const r = await salvarCliente({}, form({ ...valido, id: "123" }));
    expect(r.erros?._form).toBeTruthy();
    expect(atualizarCliente).not.toHaveBeenCalled();
    expect(criarCliente).not.toHaveBeenCalled();
  });

  it("falha do repositorio devolve erro amigavel e registra o detalhe", async () => {
    criarCliente.mockRejectedValue(new Error("detalhe tecnico secreto"));
    const r = await salvarCliente({}, form(valido));
    expect(r.erros).toEqual({ _form: "Não foi possível salvar. Tente novamente." });
    expect(JSON.stringify(r)).not.toContain("secreto");
    expect(console.error).toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("falha ao atualizar tambem devolve erro amigavel", async () => {
    atualizarCliente.mockRejectedValue(new Error("x"));
    const r = await salvarCliente({}, form({ ...valido, id: ID }));
    expect(r.erros?._form).toBe("Não foi possível salvar. Tente novamente.");
  });
});

describe("removerCliente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    excluirCliente.mockResolvedValue(undefined);
  });

  it("exclui e revalida", async () => {
    expect(await removerCliente(ID)).toEqual({ ok: true });
    expect(excluirCliente).toHaveBeenCalledWith(db, ID);
    expect(revalidatePath).toHaveBeenCalledWith("/clientes");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("id invalido nao chama o repositorio", async () => {
    const r = await removerCliente("nao-e-uuid");
    expect(r.erro).toBeTruthy();
    expect(excluirCliente).not.toHaveBeenCalled();
  });

  it("falha do repositorio devolve erro amigavel, sem lancar, e registra o detalhe", async () => {
    excluirCliente.mockRejectedValue(new Error("detalhe tecnico secreto"));
    const r = await removerCliente(ID);
    expect(r).toEqual({ erro: "Não foi possível excluir. Tente novamente." });
    expect(console.error).toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
