import type { SupabaseClient } from "@supabase/supabase-js";

export type Sessao = {
  usuarioId: string;
  empresaId: string;
  papel: "admin" | "membro";
  precisaTrocarSenha: boolean;
};

export type EstadoSessao =
  | { tipo: "sem-usuario" }
  | { tipo: "sem-perfil" }
  | { tipo: "sessao-invalida" }
  | { tipo: "valida"; sessao: Sessao };

/** 4xx de auth (JWT de usuario removido, refresh token invalido) nao melhora ao repetir; 429 e transitorio. */
function ehErroDeSessaoInvalida(erro: { status?: number }): boolean {
  const { status } = erro;
  return status !== undefined && status >= 400 && status < 500 && status !== 429;
}

/**
 * Valida o token com o Auth (getUser) e busca empresa/papel em `perfis`.
 * Sessao ausente vira "sem-usuario"; 4xx de auth vira "sessao-invalida" (quem chama deve limpar
 * os cookies). Rede/5xx/429 ou falha na consulta de `perfis` lancam erro com o detalhe, sem
 * registrar: quem captura registra uma unica vez.
 */
export async function obterEstadoSessao(db: SupabaseClient): Promise<EstadoSessao> {
  const { data: auth, error: erroAuth } = await db.auth.getUser();
  if (erroAuth && erroAuth.name !== "AuthSessionMissingError") {
    if (ehErroDeSessaoInvalida(erroAuth)) return { tipo: "sessao-invalida" };
    // Rede/5xx nao equivale a "sem usuario": quem chama falha fechado, sem deslogar.
    throw new Error(`Falha ao validar o usuario: ${erroAuth.message}`);
  }
  if (erroAuth || !auth.user) return { tipo: "sem-usuario" };

  const { data: perfil, error: erroPerfil } = await db
    .from("perfis")
    .select("empresa_id, papel, precisa_trocar_senha")
    .eq("usuario_id", auth.user.id)
    .maybeSingle();
  if (erroPerfil) throw new Error(`Falha ao consultar o perfil do usuario: ${erroPerfil.message}`);
  if (!perfil) return { tipo: "sem-perfil" };

  return {
    tipo: "valida",
    sessao: {
      usuarioId: auth.user.id,
      empresaId: perfil.empresa_id,
      papel: perfil.papel,
      precisaTrocarSenha: perfil.precisa_trocar_senha === true,
    },
  };
}

/** null se nao ha usuario ou perfil; lanca erro se a consulta de perfis falhar. */
export async function obterSessao(db: SupabaseClient): Promise<Sessao | null> {
  const estado = await obterEstadoSessao(db);
  return estado.tipo === "valida" ? estado.sessao : null;
}
