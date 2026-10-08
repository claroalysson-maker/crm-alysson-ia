import { cookies } from "next/headers";
import { createServerClient as criarClienteSSR } from "@supabase/ssr";
import { getEnv } from "@/lib/env";

export async function createServerClient() {
  // cookies() primeiro: marca a renderizacao como dinamica antes de ler o ambiente.
  const armazenamento = await cookies();
  const env = getEnv();
  return criarClienteSSR(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => armazenamento.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => armazenamento.set(name, value, options));
        } catch {
          // Chamado de um Server Component: a escrita de cookies e ignorada de
          // forma intencional, pois o proxy renova a sessao a cada requisicao.
        }
      },
    },
  });
}
