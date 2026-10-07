import { expect, type Locator, type Page } from "@playwright/test";
import { clienteServico } from "../integration/helpers";
import { lerCredenciais } from "./credenciais";

export type ClienteSemente = {
  nome: string;
  status?: "lead" | "cliente" | "perdido";
  valor_estimado?: number;
  email?: string;
};

/** Apaga os clientes da empresa de teste: cada teste parte de um estado conhecido. */
export async function limparClientes(): Promise<void> {
  const { empresaId } = lerCredenciais();
  const { error } = await clienteServico().from("clientes").delete().eq("empresa_id", empresaId);
  if (error) throw new Error(`Falha ao limpar clientes: ${error.message}`);
}

/** Insere clientes direto pelo service client (rapido); a limpeza fica a cargo dos testes. */
export async function semearClientes(clientes: ClienteSemente[]): Promise<void> {
  const { empresaId } = lerCredenciais();
  const linhas = clientes.map((c) => ({ empresa_id: empresaId, ...c }));
  const { error } = await clienteServico().from("clientes").insert(linhas);
  if (error) throw new Error(`Falha ao semear clientes: ${error.message}`);
}

export async function entrarPelaTela(page: Page, email: string, senha: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/** Cartao de indicador do dashboard, localizado pelo titulo (so visiveis: o Next mantem rotas anteriores ocultas). */
export function cartao(page: Page, titulo: string): Locator {
  return page.locator('[data-slot="card"]:visible').filter({ hasText: titulo });
}

export async function esperarValor(page: Page, titulo: string, valor: string): Promise<void> {
  await expect(cartao(page, titulo).locator("p")).toHaveText(valor);
}
