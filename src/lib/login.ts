import type { SupabaseClient } from "@supabase/supabase-js";
import { obterSessao } from "@/lib/supabase/session";

export const ERRO_CREDENCIAIS = "E-mail ou senha incorretos";
export const ERRO_SEM_EMPRESA = "Sua conta não está vinculada a uma empresa";

export async function autenticar(
  db: SupabaseClient,
  email: string,
  senha: string,
): Promise<{ erro?: string }> {
  const { error } = await db.auth.signInWithPassword({ email, password: senha });
  if (error) return { erro: ERRO_CREDENCIAIS };

  if (!(await obterSessao(db))) {
    await db.auth.signOut();
    return { erro: ERRO_SEM_EMPRESA };
  }
  return {};
}
