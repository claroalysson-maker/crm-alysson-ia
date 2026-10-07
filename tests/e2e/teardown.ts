import { existsSync, rmSync } from "node:fs";
import { clienteServico, limparEmpresaComUsuario } from "../integration/helpers";
import { ARQUIVO_CREDENCIAIS, PASTA_AUTH, lerCredenciais } from "./credenciais";

async function contar(tabela: string, coluna: string, valor: string): Promise<number> {
  const { count, error } = await clienteServico()
    .from(tabela)
    .select("*", { count: "exact", head: true })
    .eq(coluna, valor);
  if (error) throw new Error(`Falha ao verificar ${tabela}: ${error.message}`);
  return count ?? 0;
}

/** 1 se o usuario ainda existe, 0 se o Auth confirma que nao existe; qualquer outro erro falha. */
async function contarUsuario(usuarioId: string): Promise<number> {
  const { data, error } = await clienteServico().auth.admin.getUserById(usuarioId);
  if (error) {
    if (error.status === 404 || error.code === "user_not_found") return 0;
    throw new Error(`Falha ao verificar o usuario no Auth: ${error.message}`);
  }
  return data.user ? 1 : 0;
}

/** Remove tudo que a execucao criou e prova que nada restou no banco. */
export default async function globalTeardown(): Promise<void> {
  if (!existsSync(ARQUIVO_CREDENCIAIS)) return;
  const credenciais = lerCredenciais();
  await limparEmpresaComUsuario(credenciais);

  const restos = {
    clientes: await contar("clientes", "empresa_id", credenciais.empresaId),
    perfis: await contar("perfis", "empresa_id", credenciais.empresaId),
    empresas: await contar("empresas", "id", credenciais.empresaId),
  };
  const usuarios = await contarUsuario(credenciais.usuarioId);
  const total = restos.clientes + restos.perfis + restos.empresas + usuarios;
  if (total !== 0) {
    throw new Error(`Teardown E2E deixou linhas no banco: ${JSON.stringify({ ...restos, usuarios })}`);
  }
  rmSync(PASTA_AUTH, { recursive: true, force: true });
}
