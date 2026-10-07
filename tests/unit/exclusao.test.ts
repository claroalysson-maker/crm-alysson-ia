import { describe, expect, it, vi } from "vitest";
import { ERRO_EXCLUIR, confirmarExclusao, podeAlterarAbertura } from "@/lib/clientes/exclusao";

describe("confirmarExclusao", () => {
  it("devolve ok quando a acao remove o cliente", async () => {
    const remover = vi.fn().mockResolvedValue({ ok: true });
    expect(await confirmarExclusao(remover, "id-1")).toEqual({ ok: true });
    expect(remover).toHaveBeenCalledExactlyOnceWith("id-1");
  });

  it("repassa o erro amigavel devolvido pela acao", async () => {
    const remover = vi.fn().mockResolvedValue({ erro: "Cliente inválido." });
    expect(await confirmarExclusao(remover, "id-1")).toEqual({ erro: "Cliente inválido." });
  });

  it("converte excecao da acao (ex.: rede) na mensagem amigavel, sem rejeitar", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const remover = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(confirmarExclusao(remover, "id-1")).resolves.toEqual({ erro: ERRO_EXCLUIR });
    expect(log).toHaveBeenCalledExactlyOnceWith(expect.any(String), "Failed to fetch");
    log.mockRestore();
  });
});

describe("podeAlterarAbertura", () => {
  it.each([
    [true, false, true],
    [false, false, true],
    [true, true, true],
    [false, true, false], // Esc/overlay durante a exclusao pendente e ignorado
  ])("novo=%s, pendente=%s => %s", (novo, pendente, esperado) => {
    expect(podeAlterarAbertura(novo, pendente)).toBe(esperado);
  });
});
