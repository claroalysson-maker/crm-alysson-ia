import { expect, test } from "@playwright/test";
import { ARQUIVO_SESSAO, lerCredenciais } from "./credenciais";
import { entrarPelaTela, limparClientes } from "./apoio";

const SEM_SESSAO = { cookies: [], origins: [] };
const ERRO_CREDENCIAIS = "E-mail ou senha incorretos";

test.describe("sem sessao", () => {
  test.use({ storageState: SEM_SESSAO });

  for (const rota of ["/dashboard", "/clientes", "/"]) {
    test(`${rota} sem sessao redireciona para /login`, async ({ page }) => {
      await page.goto(rota);
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  test("senha errada mostra a mensagem generica e permanece em /login", async ({ page }) => {
    const { email } = lerCredenciais();
    await entrarPelaTela(page, email, "senha-errada-123");

    await expect(page.getByText(ERRO_CREDENCIAIS, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("e-mail desconhecido mostra a mesma mensagem", async ({ page }) => {
    await entrarPelaTela(page, "ninguem-existe@teste.invalid", "qualquer-senha-123");

    await expect(page.getByText(ERRO_CREDENCIAIS, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("login valido leva ao dashboard com o estado vazio", async ({ page }) => {
    await limparClientes();
    const { email, senha } = lerCredenciais();
    await entrarPelaTela(page, email, senha);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Adicionar primeiro cliente" })).toBeVisible();
    await expect(page.locator('[data-slot="card"]:visible')).toHaveCount(0);
    await expect(page.getByRole("img")).toHaveCount(0);
  });

  test("Sair encerra a sessao e /dashboard volta a redirecionar", async ({ page }) => {
    const { email, senha } = lerCredenciais();
    await entrarPelaTela(page, email, senha);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("com sessao", () => {
  test.use({ storageState: ARQUIVO_SESSAO });

  test("/login redireciona para /dashboard", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("sessao invalida nos cookies volta ao login sem erro", async ({ page, context }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);

    const cookies = await context.cookies();
    const autenticacao = cookies.filter((c) => c.name.startsWith("sb-"));
    expect(autenticacao.length).toBeGreaterThan(0);
    await context.addCookies(autenticacao.map((c) => ({ ...c, value: "lixo-invalido" })));

    const resposta = await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    expect(resposta?.status()).toBeLessThan(400);
    await expect(page.getByLabel("E-mail")).toBeVisible();
  });
});
