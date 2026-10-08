import { expect, test, type Page } from "@playwright/test";
import { ARQUIVO_SESSAO } from "./credenciais";
import { esperarValor, limparClientes, semearClientes } from "./apoio";

test.use({ storageState: ARQUIVO_SESSAO });
test.beforeEach(limparClientes);
test.afterAll(limparClientes);

function linha(page: Page, nome: string) {
  return page.getByRole("row").filter({ hasText: nome });
}

test("cria um cliente e o ve na lista e nos indicadores", async ({ page }) => {
  await page.goto("/clientes");
  await page.getByRole("button", { name: "Adicionar primeiro cliente" }).click();

  const painel = page.getByRole("dialog", { name: "Novo cliente" });
  await painel.getByLabel("Nome").fill("Maria Souza");
  await expect(painel.getByLabel("Status")).toHaveValue("lead");
  await painel.getByLabel("Valor estimado (R$)").fill("1500");
  await painel.getByRole("button", { name: "Salvar" }).click();
  await expect(painel).toBeHidden();

  const registro = linha(page, "Maria Souza");
  await expect(registro).toBeVisible();
  await expect(registro).toContainText(/R\$\s1\.500,00/);
  await expect(registro.getByText("Lead", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await esperarValor(page, "Total de leads", "1");
  await esperarValor(page, "Valor em negociação", "R$ 1.500,00");
});

test("aceita valor com virgula decimal (1500,50) e exibe em reais", async ({ page }) => {
  await page.goto("/clientes");
  await page.getByRole("button", { name: "Adicionar primeiro cliente" }).click();

  const painel = page.getByRole("dialog", { name: "Novo cliente" });
  await painel.getByLabel("Nome").fill("Carlos Dias");
  await painel.getByLabel("Valor estimado (R$)").fill("1500,50");
  await painel.getByRole("button", { name: "Salvar" }).click();
  await expect(painel).toBeHidden();

  await expect(linha(page, "Carlos Dias")).toContainText(/R\$\s1\.500,50/);
});

test("edita um cliente com o formulario preenchido e reflete no dashboard", async ({ page }) => {
  await semearClientes([{ nome: "Joao Lima", status: "lead", valor_estimado: 800 }]);
  await page.goto("/clientes");

  await page.getByRole("button", { name: "Editar Joao Lima" }).click();
  const painel = page.getByRole("dialog", { name: "Editar cliente" });
  await expect(painel.getByLabel("Nome")).toHaveValue("Joao Lima");
  await expect(painel.getByLabel("Status")).toHaveValue("lead");
  await expect(painel.getByLabel("Valor estimado (R$)")).toHaveValue("800");

  await painel.getByLabel("Nome").fill("Joao Lima Junior");
  await painel.getByLabel("Status").selectOption("cliente");
  await painel.getByRole("button", { name: "Salvar" }).click();
  await expect(painel).toBeHidden();

  const registro = linha(page, "Joao Lima Junior");
  await expect(registro).toBeVisible();
  await expect(registro.getByText("Cliente", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await esperarValor(page, "Total de leads", "0");
  await esperarValor(page, "Total de clientes", "1");
  await esperarValor(page, "Taxa de conversão", "100%");
});

test("exclui um cliente so apos confirmar no dialogo", async ({ page }) => {
  await semearClientes([{ nome: "Pedro Alves" }, { nome: "Rita Gomes" }]);
  await page.goto("/clientes");

  await page.getByRole("button", { name: "Excluir Pedro Alves" }).click();
  const dialogo = page.getByRole("alertdialog", { name: "Excluir cliente?" });
  await expect(dialogo).toContainText("Pedro Alves");
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toBeHidden();
  await expect(linha(page, "Pedro Alves")).toBeVisible();

  await page.getByRole("button", { name: "Excluir Pedro Alves" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(linha(page, "Pedro Alves")).toHaveCount(0);
  await expect(linha(page, "Rita Gomes")).toBeVisible();
});
