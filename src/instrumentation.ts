/**
 * Roda uma vez na subida do servidor Next: falha cedo, com o nome da variavel
 * ausente, em vez de quebrar na primeira requisicao.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEnv } = await import("@/lib/env");
  getEnv();
}
