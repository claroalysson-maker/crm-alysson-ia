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
  let empresaId: string | undefined;
  let usuarioId: string | undefined;

  try {
    const { data: empresa, error: erroEmpresa } = await servico
      .from("empresas")
      .insert({ nome: nomeEmpresa })
      .select("id")
      .single();
    if (erroEmpresa) throw new Error(`Falha ao criar empresa: ${erroEmpresa.message}`);
    const idEmpresa: string = empresa.id;
    empresaId = idEmpresa;

    const { data: criado, error: erroUsuario } = await servico.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });
    if (erroUsuario || !criado.user) {
      throw new Error(`Falha ao criar usuario: ${erroUsuario?.message}`);
    }
    const idUsuario: string = criado.user.id;
    usuarioId = idUsuario;

    const { error: erroPerfil } = await servico
      .from("perfis")
      .insert({ usuario_id: idUsuario, empresa_id: idEmpresa, papel: "admin" });
    if (erroPerfil) throw new Error(`Falha ao criar perfil: ${erroPerfil.message}`);

    const clienteSupabase = clienteAnonimo();
    const { error: erroLogin } = await clienteSupabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (erroLogin) throw new Error(`Falha ao autenticar usuario: ${erroLogin.message}`);

    return { empresaId: idEmpresa, usuarioId: idUsuario, clienteSupabase };
  } catch (erro) {
    try {
      await limparRecursos(empresaId, usuarioId);
    } catch (erroLimpeza) {
      console.error("Falha ao limpar recursos parciais:", (erroLimpeza as Error).message);
    }
    throw erro;
  }
}

async function limparRecursos(
  empresaId: string | undefined,
  usuarioId: string | undefined,
): Promise<void> {
  const servico = clienteServico();
  const erros: string[] = [];
  const registrar = (etapa: string, erro: { message: string } | null) => {
    if (erro) erros.push(`${etapa}: ${erro.message}`);
  };

  if (empresaId) {
    registrar("clientes", (await servico.from("clientes").delete().eq("empresa_id", empresaId)).error);
  }
  if (usuarioId) {
    registrar("usuario", (await servico.auth.admin.deleteUser(usuarioId)).error);
  }
  if (empresaId) {
    registrar("perfis", (await servico.from("perfis").delete().eq("empresa_id", empresaId)).error);
    registrar("empresas", (await servico.from("empresas").delete().eq("id", empresaId)).error);
  }

  if (erros.length > 0) {
    throw new Error(`Falha na limpeza de teste: ${erros.join("; ")}`);
  }
}

export async function limparEmpresaComUsuario(
  { empresaId, usuarioId }: Pick<EmpresaComUsuario, "empresaId" | "usuarioId">,
): Promise<void> {
  await limparRecursos(empresaId, usuarioId);
}

export async function criarUsuarioSemEmpresa(
  email: string,
  senha: string,
): Promise<{ usuarioId: string }> {
  const { data, error } = await clienteServico().auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Falha ao criar usuario sem empresa: ${error?.message}`);
  }
  return { usuarioId: data.user.id };
}

export async function limparUsuario(usuarioId: string): Promise<void> {
  const { error } = await clienteServico().auth.admin.deleteUser(usuarioId);
  if (error) throw new Error(`Falha na limpeza de teste: usuario: ${error.message}`);
}
