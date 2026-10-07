import { validarProjetoDeTeste } from "../integration/projeto-de-teste";

const URLS_DO_SUPABASE = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const;

/**
 * O E2E usa a service-role (setup/teardown) e embute a URL publica no build: as duas URLs
 * precisam apontar para o projeto de teste declarado, antes de construir ou subir o servidor.
 */
export function validarAmbienteE2E(env: Record<string, string | undefined>): void {
  for (const nome of URLS_DO_SUPABASE) {
    const url = env[nome];
    if (!url) throw new Error(`Defina ${nome} no ambiente para rodar os testes E2E.`);
    try {
      validarProjetoDeTeste(url, env.TEST_SUPABASE_PROJECT_REF);
    } catch (erro) {
      throw new Error(`${nome}: ${(erro as Error).message}`);
    }
  }
}
