import { existsSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ENV_FILE = path.resolve(__dirname, "../../.env.test.local");
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variavel de ambiente ausente para testes de integracao: ${nome}`);
  }
  return valor;
}

const opcoes = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export function clienteServico(): SupabaseClient {
  return createClient(exigir("SUPABASE_URL"), exigir("SUPABASE_SERVICE_ROLE_KEY"), opcoes);
}

export function clienteAnonimo(): SupabaseClient {
  return createClient(exigir("SUPABASE_URL"), exigir("SUPABASE_ANON_KEY"), opcoes);
}

export type EmpresaComUsuario = {
  empresaId: string;
  usuarioId: string;
  clienteSupabase: SupabaseClient;
};

export async function criarEmpresaComUsuario(
  nomeEmpresa: string,
  email: string,
  senha: string,
): Promise<EmpresaComUsuario> {
  const servico = clienteServico();

  const { data: empresa, error: erroEmpresa } = await servico
    .from("empresas")
    .insert({ nome: nomeEmpresa })
    .select("id")
    .single();
  if (erroEmpresa) throw new Error(`Falha ao criar empresa: ${erroEmpresa.message}`);

  const { data: criado, error: erroUsuario } = await servico.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (erroUsuario || !criado.user) {
    throw new Error(`Falha ao criar usuario: ${erroUsuario?.message}`);
  }
  const usuarioId = criado.user.id;

  const { error: erroPerfil } = await servico
    .from("perfis")
    .insert({ usuario_id: usuarioId, empresa_id: empresa.id, papel: "admin" });
  if (erroPerfil) throw new Error(`Falha ao criar perfil: ${erroPerfil.message}`);

  const clienteSupabase = clienteAnonimo();
  const { error: erroLogin } = await clienteSupabase.auth.signInWithPassword({
    email,
    password: senha,
  });
  if (erroLogin) throw new Error(`Falha ao autenticar usuario: ${erroLogin.message}`);

  return { empresaId: empresa.id, usuarioId, clienteSupabase };
}

export async function limparEmpresaComUsuario(
  { empresaId, usuarioId }: Pick<EmpresaComUsuario, "empresaId" | "usuarioId">,
): Promise<void> {
  const servico = clienteServico();
  await servico.from("clientes").delete().eq("empresa_id", empresaId);
  await servico.auth.admin.deleteUser(usuarioId);
  await servico.from("perfis").delete().eq("empresa_id", empresaId);
  await servico.from("empresas").delete().eq("id", empresaId);
}
