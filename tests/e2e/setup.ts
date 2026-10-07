import { rmSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { chromium, type FullConfig } from "@playwright/test";
import { criarEmpresaComUsuario, limparEmpresaComUsuario } from "../integration/helpers";
import { ARQUIVO_SESSAO, PASTA_AUTH, salvarCredenciais } from "./credenciais";

/** Cria empresa + usuario unicos desta execucao e grava uma sessao reutilizavel. */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const sufixo = randomUUID();
  const email = `e2e-${sufixo}@teste.invalid`;
  const senha = `Aa1-${randomBytes(12).toString("hex")}`;

  const criado = await criarEmpresaComUsuario(`E2E ${sufixo}`, email, senha);
  const credenciais = { email, senha, empresaId: criado.empresaId, usuarioId: criado.usuarioId };
  // Gravado antes de qualquer outra etapa: o teardown sempre sabe o que limpar.
  salvarCredenciais(credenciais);

  try {
    const baseURL = config.projects[0].use.baseURL;
    const navegador = await chromium.launch();
    try {
      const pagina = await navegador.newPage({ baseURL });
      await pagina.goto("/login");
      await pagina.getByLabel("E-mail").fill(email);
      await pagina.getByLabel("Senha").fill(senha);
      await pagina.getByRole("button", { name: "Entrar" }).click();
      await pagina.waitForURL("**/dashboard", { timeout: 45_000 });
      await pagina.context().storageState({ path: ARQUIVO_SESSAO });
    } finally {
      await navegador.close();
    }
  } catch (erro) {
    await limparEmpresaComUsuario(credenciais);
    rmSync(PASTA_AUTH, { recursive: true, force: true });
    throw erro;
  }
}
