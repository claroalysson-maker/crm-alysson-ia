import { describe, expect, it } from "vitest";
import { escaparTermoBusca, expressaoBusca } from "@/lib/clientes/busca";

describe("escaparTermoBusca", () => {
  it("envolve o termo em curingas e aspas", () => {
    expect(escaparTermoBusca("ana")).toBe('"%ana%"');
  });

  it("escapa % e _ para o LIKE (barra dobrada por causa das aspas)", () => {
    expect(escaparTermoBusca("a%b_c")).toBe(String.raw`"%a\\%b\\_c%"`);
  });

  it("escapa a barra invertida literal", () => {
    expect(escaparTermoBusca(String.raw`a\b`)).toBe(String.raw`"%a\\\\b%"`);
  });

  it("escapa aspas para o PostgREST", () => {
    expect(escaparTermoBusca('a"b')).toBe(String.raw`"%a\"b%"`);
  });

  it("virgula e parenteses ficam dentro das aspas, sem escape", () => {
    expect(escaparTermoBusca("a,b(c)")).toBe('"%a,b(c)%"');
  });

  it("asterisco (curinga do PostgREST) vira _ para nao ampliar a busca", () => {
    expect(escaparTermoBusca("a*b")).toBe('"%a_b%"');
  });
});

describe("expressaoBusca", () => {
  it("monta o or() sobre nome e email com o mesmo padrao", () => {
    expect(expressaoBusca("ana")).toBe(
      'nome.ilike."%ana%",email.ilike."%ana%"',
    );
  });
});
