import { expect, test, type Page } from "@playwright/test";
import { ARQUIVO_SESSAO } from "./credenciais";
import { limparClientes, semearClientes } from "./apoio";

const SEM_SESSAO = { cookies: [], origins: [] };

test.use({ storageState: ARQUIVO_SESSAO });
test.beforeEach(async () => {
  await limparClientes();
  await semearClientes([
    { nome: "Cliente Responsivo", email: "responsivo@exemplo.com", valor_estimado: 100 },
  ]);
});
test.afterAll(limparClientes);

async function semRolagemHorizontal(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
}

async function controlesSemRotulo(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLInputElement>("input, select, textarea"))
      .filter((el) => el.type !== "hidden")
      .filter((el) => !el.labels?.length && !el.getAttribute("aria-label"))
      .map((el) => el.outerHTML.slice(0, 80)),
  );
}

test.describe("celular", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("menu lateral recolhido abre pelo hamburguer e navega", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("img", { name: /Distribuição por status/ })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeHidden();
    expect(await semRolagemHorizontal(page)).toBe(true);

    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();
    await page.getByRole("link", { name: "Clientes" }).click();

    await expect(page).toHaveURL(/\/clientes$/);
    await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();
    await expect(page.getByText("Cliente Responsivo")).toBeVisible();
    expect(await semRolagemHorizontal(page)).toBe(true);
  });
});

test.describe("acessibilidade", () => {
  test("paginas autenticadas em pt-BR com titulo proprio", async ({ page }) => {
    for (const [rota, titulo] of [
      ["/dashboard", "Dashboard | CRM"],
      ["/clientes", "Clientes | CRM"],
    ]) {
      await page.goto(rota);
      await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
      await expect(page).toHaveTitle(titulo);
    }
  });

  test("login em pt-BR com titulo proprio (sem sessao)", async ({ browser }) => {
    const contexto = await browser.newContext({ storageState: SEM_SESSAO });
    const page = await contexto.newPage();
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(page).toHaveTitle("Entrar | CRM");
    await contexto.close();
  });

  test("campos do login tem rotulo", async ({ browser }) => {
    const contexto = await browser.newContext({ storageState: SEM_SESSAO });
    const page = await contexto.newPage();
    await page.goto("/login");
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    expect(await controlesSemRotulo(page)).toEqual([]);
    await contexto.close();
  });

  test("campos de /clientes, do painel e do dashboard tem rotulo", async ({ page }) => {
    await page.goto("/clientes");
    await expect(page.getByRole("searchbox", { name: "Buscar" })).toBeVisible();
    await expect(page.getByLabel("Status")).toBeVisible();
    expect(await controlesSemRotulo(page)).toEqual([]);

    await page.getByRole("button", { name: "Novo cliente" }).click();
    const painel = page.getByRole("dialog", { name: "Novo cliente" });
    for (const rotulo of [
      "Nome",
      "E-mail",
      "Telefone",
      "Empresa",
      "Status",
      "Valor estimado (R$)",
      "Notas",
    ]) {
      await expect(painel.getByLabel(rotulo)).toBeVisible();
    }

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    expect(await controlesSemRotulo(page)).toEqual([]);
  });
});
