import { z } from "zod";

const esquemaEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type Env = { SUPABASE_URL: string; SUPABASE_ANON_KEY: string };

export function getEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const resultado = esquemaEnv.safeParse(source);
  if (!resultado.success) {
    const ausentes = resultado.error.issues
      .map((i) => i.path.join("."))
      .join(", ");
    throw new Error(`Variável de ambiente ausente ou inválida: ${ausentes}`);
  }
  return {
    SUPABASE_URL: resultado.data.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: resultado.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
