import { expect, test, type Page } from "@playwright/test";
import { ARQUIVO_SESSAO } from "./credenciais";
import { limparClientes, semearClientes } from "./apoio";

test.use({ storageState: ARQUIVO_SESSAO });
test.beforeEach(limparClientes);
test.afterAll(limparClientes);

const LINHAS = "tbody tr";

async function buscar(page: Page, termo: string): Promise<void> {
  await page.getByRole("searchbox", { name: "Buscar" }).fill(termo);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
}

test("busca por texto filtra a lista pela URL", async ({ page }) => {
  await semearClientes([{ nome: "Ana Silva" }, { nome: "Bruno Costa" }]);
  await page.goto("/clientes");

  await buscar(page, "Ana");

  await expect(page).toHaveURL(/busca=Ana/);
  await expect(page.locator(LINHAS)).toHaveCount(1);
  await expect(page.locator(LINHAS)).toContainText("Ana Silva");
});

test("busca sem resultado mostra a mensagem de vazio", async ({ page }) => {
  await semearClientes([{ nome: "Ana Silva" }]);
  await page.goto("/clientes");

  await buscar(page, "inexistente");

  await expect(page.getByText("Nenhum resultado para esta busca.")).toBeVisible();
});

test("filtro de status mostra so o status escolhido", async ({ page }) => {
  await semearClientes([
    { nome: "Lead Um", status: "lead" },
    { nome: "Cliente Um", status: "cliente" },
    { nome: "Perdido Um", status: "perdido" },
  ]);
  await page.goto("/clientes");

  await page.getByLabel("Status").selectOption("perdido");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();

  await expect(page).toHaveURL(/status=perdido/);
  await expect(page.locator(LINHAS)).toHaveCount(1);
  await expect(page.locator(LINHAS)).toContainText("Perdido Um");
});

for (const [curinga, esperado] of [
  ["%", "Bruno 100%"],
  ["_", "Carla_X"],
] as const) {
  test(`caractere especial "${curinga}" na busca nao retorna tudo`, async ({ page }) => {
    await semearClientes([
      { nome: "Ana Silva" },
      { nome: "Bruno 100%" },
      { nome: "Carla_X" },
      { nome: "Daniel Reis" },
    ]);
    await page.goto("/clientes");

    await buscar(page, curinga);

    await expect(page.locator(LINHAS)).toHaveCount(1);
    await expect(page.locator(LINHAS)).toContainText(esperado);
  });
}

test("paginacao aparece com mais de 20 clientes e navega entre paginas", async ({ page }) => {
  const nomes = Array.from({ length: 25 }, (_, i) => ({
    nome: `Cliente ${String(i + 1).padStart(2, "0")}`,
  }));
  await semearClientes(nomes);
  await page.goto("/clientes");

  await expect(page.getByText("Página 1 de 2")).toBeVisible();
  await expect(page.locator(LINHAS)).toHaveCount(20);

  // Achado: o Button do Base UI com render=<Link> expoe <a role="button">, nao role link.
  const proxima = page.getByRole("navigation", { name: "Paginação" }).getByText("Próxima");
  await proxima.click();

  await expect(page).toHaveURL(/pagina=2/);
  await expect(page.getByText("Página 2 de 2")).toBeVisible();
  await expect(page.locator(LINHAS)).toHaveCount(5);
});
