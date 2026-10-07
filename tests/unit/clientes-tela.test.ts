import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listarClientes = vi.fn();
const ordem: string[] = [];
const conexao = vi.fn(async () => {
  ordem.push("connection");
});

vi.mock("next/server", () => ({ connection: () => conexao() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => ({}) }));
vi.mock("@/lib/clientes/repositorio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/clientes/repositorio")>()),
  listarClientes: (...a: unknown[]) => listarClientes(...a),
}));
vi.mock("@/app/(app)/clientes/actions", () => ({
  salvarCliente: vi.fn(),
  removerCliente: vi.fn(),
}));

import { ConteudoClientes } from "@/app/(app)/clientes/conteudo";
import { FiltrosClientes } from "@/components/clientes/filtros";
import { Paginacao, hrefDaPagina } from "@/components/clientes/paginacao";
import { TabelaClientes } from "@/components/clientes/tabela";
import { formatarMoeda } from "@/lib/clientes/formato";
import type { Cliente } from "@/lib/clientes/schema";

const cliente = (parcial: Partial<Cliente> = {}): Cliente => ({
  id: "7b0f5a2e-3c1d-4f6a-9b8e-1a2b3c4d5e6f",
  empresa_id: "e1",
  nome: "Ana Souza",
  email: "ana@x.com",
  telefone: null,
  empresa_contato: null,
  status: "lead",
  valor_estimado: 1500,
  notas: null,
  criado_em: "2026-01-01T00:00:00Z",
  atualizado_em: "2026-01-01T00:00:00Z",
  ...parcial,
});

async function renderizar(busca: Record<string, string> = {}): Promise<string> {
  const elemento = await ConteudoClientes({ searchParams: Promise.resolve(busca) });
  return renderToStaticMarkup(elemento);
}

describe("formatarMoeda", () => {
  it("formata em reais pt-BR", () => {
    expect(formatarMoeda(1500).replace(/\s/g, " ")).toBe("R$ 1.500,00");
    expect(formatarMoeda("0.5").replace(/\s/g, " ")).toBe("R$ 0,50");
  });
});

describe("TabelaClientes", () => {
  it("mostra colunas, status por texto, valor formatado e acoes acessiveis", () => {
    const html = renderToStaticMarkup(
      createElement(TabelaClientes, { clientes: [cliente(), cliente({ id: "x", nome: "Bia", status: "perdido" })] }),
    );
    for (const coluna of ["Nome", "E-mail", "Telefone", "Status", "Valor estimado", "Ações"]) {
      expect(html).toContain(coluna);
    }
    expect(html).toContain("Lead");
    expect(html).toContain("Perdido");
    expect(html).toContain("1.500,00");
    expect(html).toContain('aria-label="Editar Ana Souza"');
    expect(html).toContain('aria-label="Excluir Ana Souza"');
  });
});

describe("links estilizados como botao", () => {
  it("Anterior/Proxima sao links simples, sem role=button", () => {
    const html = renderToStaticMarkup(
      createElement(Paginacao, { pagina: 2, totalPaginas: 3, busca: "", status: undefined }),
    );
    expect(html).toContain('<a ');
    expect(html).not.toContain('role="button"');
    expect(html).toMatch(/<a [^>]*href="\/clientes"[^>]*>Anterior<\/a>/);
    expect(html).toMatch(/<a [^>]*href="\/clientes\?pagina=3"[^>]*>Próxima<\/a>/);
  });

  it("Limpar filtros e link simples, sem role=button", () => {
    const html = renderToStaticMarkup(
      createElement(FiltrosClientes, { busca: "ana", status: undefined }),
    );
    expect(html).toMatch(/<a [^>]*href="\/clientes"[^>]*>Limpar filtros<\/a>/);
    expect(html).not.toContain('role="button"');
  });
});

describe("Paginacao", () => {
  it("mostra Pagina X de Y e desabilita Anterior na primeira pagina", () => {
    const html = renderToStaticMarkup(
      createElement(Paginacao, { pagina: 1, totalPaginas: 3, busca: "ana", status: "lead" }),
    );
    expect(html).toContain("Página 1 de 3");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Anterior/);
    expect(html).toContain("/clientes?busca=ana&amp;status=lead&amp;pagina=2");
  });

  it("desabilita Proxima na ultima pagina", () => {
    const html = renderToStaticMarkup(
      createElement(Paginacao, { pagina: 3, totalPaginas: 3, busca: "", status: undefined }),
    );
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Próxima/);
    expect(html).toContain('href="/clientes?pagina=2"');
  });

  it("hrefDaPagina omite pagina 1 e codifica a busca", () => {
    expect(hrefDaPagina({ busca: "a b&c", status: undefined }, 1)).toBe("/clientes?busca=a+b%26c");
    expect(hrefDaPagina({ busca: "", status: undefined }, 1)).toBe("/clientes");
  });
});

describe("ConteudoClientes (pagina /clientes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ordem.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("adia a renderizacao para o momento da requisicao antes de consultar o banco", async () => {
    listarClientes.mockImplementation(async () => {
      ordem.push("listar");
      return { itens: [], total: 0, pagina: 1, totalPaginas: 1 };
    });
    await renderizar();
    expect(ordem).toEqual(["connection", "listar"]);
  });

  it("lista falhando mostra mensagem amigavel, sem detalhe tecnico, e registra no servidor", async () => {
    listarClientes.mockRejectedValue(new Error("detalhe tecnico secreto"));
    const html = await renderizar();
    expect(html).toContain("Não foi possível carregar os clientes");
    expect(html).not.toContain("secreto");
    expect(console.error).toHaveBeenCalled();
  });

  it("sem nenhum cliente mostra estado vazio com botao de primeiro cliente", async () => {
    listarClientes.mockResolvedValue({ itens: [], total: 0, pagina: 1, totalPaginas: 1 });
    const html = await renderizar();
    expect(html).toContain("Adicionar primeiro cliente");
    expect(html).not.toContain("Nenhum resultado");
  });

  it("filtros sem correspondencia mostram 'Nenhum resultado para esta busca'", async () => {
    listarClientes.mockResolvedValue({ itens: [], total: 0, pagina: 1, totalPaginas: 1 });
    const html = await renderizar({ busca: "zzz" });
    expect(html).toContain("Nenhum resultado para esta busca");
    expect(html).not.toContain("Adicionar primeiro cliente");
    expect(html).toContain('value="zzz"');
  });

  it("com uma unica pagina nao mostra a navegacao de paginacao", async () => {
    listarClientes.mockResolvedValue({ itens: [cliente()], total: 20, pagina: 1, totalPaginas: 1 });
    const html = await renderizar();
    expect(html).toContain("Ana Souza");
    expect(html).not.toContain("Paginação");
    expect(html).not.toContain("Página 1 de");
  });

  it("com clientes mostra tabela e paginacao e repassa parametros tolerantes ao repositorio", async () => {
    listarClientes.mockResolvedValue({ itens: [cliente()], total: 45, pagina: 2, totalPaginas: 3 });
    const html = await renderizar({ busca: " ana ", status: "invalido", pagina: "2" });
    expect(listarClientes).toHaveBeenCalledWith(expect.anything(), {
      busca: "ana",
      status: undefined,
      pagina: 2,
    });
    expect(html).toContain("Ana Souza");
    expect(html).toContain("Página 2 de 3");
    expect(html).toContain("Novo cliente");
  });
});
