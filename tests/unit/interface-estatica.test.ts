import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const caminho = vi.fn<() => string>();
const redirect = vi.fn((destino: string): never => {
  throw new Error(`NEXT_REDIRECT:${destino}`);
});
const obterSessao = vi.fn();
const destinoInicial = vi.fn();

vi.mock("next/navigation", () => ({ usePathname: () => caminho(), redirect: (d: string) => redirect(d) }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/font/google", () => ({ Inter: () => ({ variable: "fonte-inter" }) }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => ({}) }));
vi.mock("@/lib/supabase/session", () => ({ obterSessao: (...a: unknown[]) => obterSessao(...a) }));
vi.mock("@/lib/supabase/destino-inicial", () => ({ destinoInicial: (...a: unknown[]) => destinoInicial(...a) }));
vi.mock("@/app/(app)/actions", () => ({ sair: vi.fn() }));
vi.mock("@/app/(app)/clientes/actions", () => ({ salvarCliente: vi.fn(), removerCliente: vi.fn() }));
vi.mock("@/app/login/actions", () => ({ entrar: vi.fn() }));
vi.mock("@/app/(app)/dashboard/conteudo", () => ({ ConteudoDashboard: () => null }));
vi.mock("@/app/(app)/clientes/conteudo", () => ({ ConteudoClientes: () => null }));

import RootLayout from "@/app/layout";
import PaginaInicial from "@/app/page";
import LayoutDoApp from "@/app/(app)/layout";
import PaginaClientes from "@/app/(app)/clientes/page";
import PaginaDashboard from "@/app/(app)/dashboard/page";
import PaginaLogin from "@/app/login/page";
import { FormularioLogin } from "@/app/login/formulario-login";
import { BotaoExcluir } from "@/components/clientes/botao-excluir";
import { FormularioCliente } from "@/components/clientes/formulario-cliente";
import { PainelForm } from "@/components/clientes/painel-form";
import { MenuLateral } from "@/components/menu-lateral";
import type { Cliente } from "@/lib/clientes/schema";

const html = (elemento: ReactElement) => renderToStaticMarkup(elemento);

/** Resolve o componente assincrono filho de um <Suspense> (o SSR estatico nao aguarda promessas). */
async function resolverFilhoAssincrono(suspense: ReactElement<{ children: ReactElement }>) {
  const filho = suspense.props.children as ReactElement<Record<string, unknown>> & {
    type: (props: Record<string, unknown>) => Promise<ReactNode>;
  };
  return filho.type(filho.props);
}

const CLIENTE: Cliente = {
  id: "7b0f5a2e-3c1d-4f6a-9b8e-1a2b3c4d5e6f",
  empresa_id: "e1",
  nome: "Ana Souza",
  email: "ana@x.com",
  telefone: "11999990000",
  empresa_contato: "Acme",
  status: "cliente",
  valor_estimado: 1500,
  notas: "Ligar na segunda",
  criado_em: "2026-01-01T00:00:00Z",
  atualizado_em: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  caminho.mockReset().mockReturnValue("/dashboard");
  redirect.mockClear();
  obterSessao.mockReset();
  destinoInicial.mockReset();
});

describe("MenuLateral", () => {
  it("marca como pagina atual apenas o item da rota ativa", () => {
    caminho.mockReturnValue("/clientes");
    const marcado = html(createElement(MenuLateral)).match(/<a [^>]*aria-current="page"[^>]*>([^<]*)</g) ?? [];
    expect(marcado).toHaveLength(1);
    expect(marcado[0]).toContain("Clientes");
  });

  it("subrotas mantem o item ativo", () => {
    caminho.mockReturnValue("/clientes/abc");
    expect(html(createElement(MenuLateral))).toMatch(/aria-current="page"[^>]*>Clientes</);
  });

  it("oferece navegacao, botao de sair e abertura do menu movel", () => {
    const saida = html(createElement(MenuLateral));
    expect(saida).toContain('aria-label="Principal"');
    expect(saida).toContain("Dashboard");
    expect(saida).toContain("Sair");
    expect(saida).toContain('aria-label="Abrir menu"');
  });
});

describe("layout do app", () => {
  const filhos = createElement("p", null, "conteudo da pagina");

  it("com sessao valida renderiza menu e conteudo", async () => {
    obterSessao.mockResolvedValue({ usuarioId: "u", empresaId: "e", papel: "admin" });
    const saida = html(
      (await resolverFilhoAssincrono(LayoutDoApp({ children: filhos }) as never)) as ReactElement,
    );
    expect(saida).toContain("conteudo da pagina");
    expect(saida).toContain('aria-label="Principal"');
  });

  it("sem sessao redireciona para /login (defesa em profundidade)", async () => {
    obterSessao.mockResolvedValue(null);
    await expect(resolverFilhoAssincrono(LayoutDoApp({ children: filhos }) as never)).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
  });

  it("falha ao validar a sessao mostra aviso e registra uma vez", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    obterSessao.mockRejectedValue(new Error("auth fora do ar"));
    const saida = html(
      (await resolverFilhoAssincrono(LayoutDoApp({ children: filhos }) as never)) as ReactElement,
    );
    expect(saida).toContain('role="alert"');
    expect(saida).toContain("Não foi possível carregar sua sessão");
    expect(saida).not.toContain("conteudo da pagina");
    expect(log).toHaveBeenCalledExactlyOnceWith(expect.any(String), "auth fora do ar");
    log.mockRestore();
  });
});

describe("pagina inicial e layout raiz", () => {
  it("a raiz redireciona para o destino inicial", async () => {
    destinoInicial.mockResolvedValue("/dashboard");
    await expect(resolverFilhoAssincrono(PaginaInicial() as never)).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("o layout raiz define idioma pt-BR e a fonte", () => {
    const saida = html(RootLayout({ children: createElement("p", null, "x") } as never) as ReactElement);
    expect(saida).toContain('<html lang="pt-BR"');
    expect(saida).toContain("fonte-inter");
  });
});

describe("paginas", () => {
  it("dashboard tem o titulo", () => {
    expect(html(PaginaDashboard())).toContain("<h1");
    expect(html(PaginaDashboard())).toContain("Dashboard");
  });

  it("clientes renderiza a pagina", () => {
    expect(html(PaginaClientes({ searchParams: Promise.resolve({}) } as never))).toContain("<main");
  });

  it("login mostra o cartao com o formulario", () => {
    const saida = html(PaginaLogin({ searchParams: Promise.resolve({}) } as never));
    expect(saida).toContain("Entrar");
    expect(saida).toContain("Acesse o CRM da sua empresa");
    expect(saida).toContain('name="email"');
  });
});

describe("FormularioLogin", () => {
  it("mostra o erro inicial no alerta e os campos de e-mail e senha", () => {
    const saida = html(createElement(FormularioLogin, { erroInicial: "Sua conta não está vinculada" }));
    expect(saida).toMatch(/role="alert"[^>]*>Sua conta não está vinculada</);
    expect(saida).toContain('type="password"');
    expect(saida).toContain(">Entrar<");
  });
});

describe("FormularioCliente e PainelForm", () => {
  it("novo cliente: status padrao lead, sem id oculto", () => {
    const saida = html(createElement(FormularioCliente, { aoSalvar: () => {} }));
    expect(saida).not.toContain('name="id"');
    expect(saida).toMatch(/<option value="lead" selected/);
    expect(saida).toContain(">Salvar<");
  });

  it("edicao: preenche os campos e leva o id oculto", () => {
    const saida = html(createElement(FormularioCliente, { cliente: CLIENTE, aoSalvar: () => {} }));
    expect(saida).toContain(`name="id" value="${CLIENTE.id}"`);
    expect(saida).toContain('value="Ana Souza"');
    expect(saida).toContain('value="1500"');
    expect(saida).toMatch(/<option value="cliente" selected/);
    expect(saida).toContain("Ligar na segunda");
  });

  it("painel fechado mostra apenas o gatilho com rotulo acessivel", () => {
    const saida = html(
      createElement(PainelForm, { rotuloAcessivel: "Novo cliente" } as never, "Novo"),
    );
    expect(saida).toContain('aria-label="Novo cliente"');
    expect(saida).not.toContain("Preencha os dados");
  });
});

describe("BotaoExcluir", () => {
  it("renderiza o gatilho com o nome do cliente no rotulo acessivel", () => {
    const saida = html(createElement(BotaoExcluir, { id: CLIENTE.id, nome: "Ana Souza" }));
    expect(saida).toContain('aria-label="Excluir Ana Souza"');
  });
});
