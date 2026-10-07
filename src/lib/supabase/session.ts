import type { SupabaseClient } from "@supabase/supabase-js";

export type Sessao = {
  usuarioId: string;
  empresaId: string;
  papel: "admin" | "membro";
};

/** Valida o token com o Auth (getUser) e busca empresa/papel em `perfis`. */
export async function obterSessao(db: SupabaseClient): Promise<Sessao | null> {
  const { data: auth, error: erroAuth } = await db.auth.getUser();
  if (erroAuth || !auth.user) return null;

  const { data: perfil, error: erroPerfil } = await db
    .from("perfis")
    .select("empresa_id, papel")
    .eq("usuario_id", auth.user.id)
    .maybeSingle();
  if (erroPerfil || !perfil) return null;

  return {
    usuarioId: auth.user.id,
    empresaId: perfil.empresa_id,
    papel: perfil.papel,
  };
}
