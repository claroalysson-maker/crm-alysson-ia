import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";
import { criarEmpresaComUsuario, limparEmpresaComUsuario } from "../integration/helpers";
import {
  ARQUIVO_CREDENCIAIS,
  ARQUIVO_SESSAO,
  PASTA_AUTH,
  lerCredenciais,
  salvarCredenciais,
  type Credenciais,
} from "./credenciais";

/** Uma execucao anterior que caiu pode ter deixado empresa/usuario: limpa antes de criar novos. */
async function limparRestoDeExecucaoAnterior(): Promise<void> {
  if (!existsSync(ARQUIVO_CREDENCIAIS)) return;
  try {
    await limparEmpresaComUsuario(lerCredenciais());
  } catch (erro) {
    throw new Error(
      `Restos de uma execucao E2E anterior nao puderam ser limpos (${ARQUIVO_CREDENCIAIS}): ${(erro as Error).message}`,
    );
  }
  rmSync(PASTA_AUTH, { recursive: true, force: true });
}

async function entrarEGravarSessao(baseURL: string | undefined, c: Credenciais): Promise<void> {
  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage({ baseURL });
    await pagina.goto("/login");
    await pagina.getByLabel("E-mail").fill(c.email);
    await pagina.getByLabel("Senha").fill(c.senha);
    await pagina.getByRole("button", { name: "Entrar" }).click();
    await pagina.waitForURL("**/dashboard", { timeout: 45_000 });
    await pagina.context().storageState({ path: ARQUIVO_SESSAO });
  } finally {
    await navegador.close();
  }
}

/** Cria empresa + usuario unicos desta execucao e grava uma sessao reutilizavel. */
export default async function globalSetup(config: FullConfig): Promise<void> {
  await limparRestoDeExecucaoAnterior();

  const sufixo = randomUUID();
  const email = `e2e-${sufixo}@teste.invalid`;
  const senha = `Aa1-${randomBytes(12).toString("hex")}`;

  const criado = await criarEmpresaComUsuario(`E2E ${sufixo}`, email, senha);
  const credenciais = { email, senha, empresaId: criado.empresaId, usuarioId: criado.usuarioId };
  // Gravado antes de qualquer outra etapa: o teardown sempre sabe o que limpar.
  salvarCredenciais(credenciais);

  try {
    await entrarEGravarSessao(config.projects[0].use.baseURL, credenciais);
  } catch (erro) {
    try {
      await limparEmpresaComUsuario(credenciais);
      rmSync(PASTA_AUTH, { recursive: true, force: true });
    } catch (erroLimpeza) {
      // Mantem os dois erros; o arquivo de credenciais fica para a proxima execucao limpar.
      throw new AggregateError(
        [erro, erroLimpeza],
        "Setup E2E falhou e a limpeza tambem falhou",
      );
    }
    throw erro;
  }
}
