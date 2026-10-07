import type { SupabaseClient } from "@supabase/supabase-js";

export type Sessao = {
  usuarioId: string;
  empresaId: string;
  papel: "admin" | "membro";
};

export type EstadoSessao =
  | { tipo: "sem-usuario" }
  | { tipo: "sem-perfil" }
  | { tipo: "valida"; sessao: Sessao };

/**
 * Valida o token com o Auth (getUser) e busca empresa/papel em `perfis`.
 * Falha em `getUser` (exceto sessao ausente) ou na consulta de `perfis` nao equivale a
 * "sem usuario"/"sem perfil": lanca erro.
 */
export async function obterEstadoSessao(db: SupabaseClient): Promise<EstadoSessao> {
  const { data: auth, error: erroAuth } = await db.auth.getUser();
  if (erroAuth && erroAuth.name !== "AuthSessionMissingError") {
    // Rede/5xx nao equivale a "sem usuario": quem chama falha fechado, sem deslogar.
    console.error("Falha ao validar usuario:", erroAuth.message);
    throw new Error("Falha ao validar o usuario");
  }
  if (erroAuth || !auth.user) return { tipo: "sem-usuario" };

  const { data: perfil, error: erroPerfil } = await db
    .from("perfis")
    .select("empresa_id, papel")
    .eq("usuario_id", auth.user.id)
    .maybeSingle();
  if (erroPerfil) {
    console.error("Falha ao consultar perfis:", erroPerfil.message);
    throw new Error("Falha ao consultar o perfil do usuario");
  }
  if (!perfil) return { tipo: "sem-perfil" };

  return {
    tipo: "valida",
    sessao: { usuarioId: auth.user.id, empresaId: perfil.empresa_id, papel: perfil.papel },
  };
}

/** null se nao ha usuario ou perfil; lanca erro se a consulta de perfis falhar. */
export async function obterSessao(db: SupabaseClient): Promise<Sessao | null> {
  const estado = await obterEstadoSessao(db);
  return estado.tipo === "valida" ? estado.sessao : null;
}
