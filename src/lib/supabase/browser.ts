import { createBrowserClient as criarClienteNavegador } from "@supabase/ssr";
import { getEnv } from "@/lib/env";

export function createBrowserClient() {
  // Literais obrigatorios: o bundler so injeta process.env.NEXT_PUBLIC_X escrito assim.
  const env = getEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return criarClienteNavegador(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}
