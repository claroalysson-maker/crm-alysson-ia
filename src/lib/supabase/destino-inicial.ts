import type { SupabaseClient } from "@supabase/supabase-js";
import { obterSessao } from "@/lib/supabase/session";

/** Destino da raiz "/". Falha transitoria de auth/perfis vai para /login, sem pagina de erro. */
export async function destinoInicial(db: SupabaseClient): Promise<"/dashboard" | "/login"> {
  try {
    return (await obterSessao(db)) ? "/dashboard" : "/login";
  } catch (erro) {
    console.error("Falha ao resolver a sessao na pagina inicial:", (erro as Error).message);
    return "/login";
  }
}
