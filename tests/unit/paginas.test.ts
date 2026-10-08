import { describe, expect, it } from "vitest";
import { TAMANHO_PAGINA, totalPaginasPara } from "@/lib/clientes/repositorio";

describe("totalPaginasPara", () => {
  it.each([
    [0, 1],
    [1, 1],
    [TAMANHO_PAGINA, 1],
    [TAMANHO_PAGINA + 1, 2],
    [2 * TAMANHO_PAGINA, 2],
    [2 * TAMANHO_PAGINA + 1, 3],
  ])("%s resultados -> %s pagina(s)", (total, esperado) => {
    expect(totalPaginasPara(total)).toBe(esperado);
  });
});
