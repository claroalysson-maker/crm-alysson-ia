/**
 * Impede que os testes de integracao (que usam a service-role key e gravam dados)
 * rodem contra o projeto errado. Refs de projeto nao sao segredos.
 */
export function validarProjetoDeTeste(url: string, refEsperado: string | undefined): void {
  if (!refEsperado) {
    throw new Error(
      "Variavel TEST_SUPABASE_PROJECT_REF ausente: defina a ref do projeto Supabase de teste " +
        "para permitir os testes de integracao.",
    );
  }
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i.exec(url)?.[1]?.toLowerCase();
  if (!ref) {
    throw new Error("SUPABASE_URL invalida: esperado https://<ref>.supabase.co");
  }
  if (ref !== refEsperado.toLowerCase()) {
    throw new Error(
      `Projeto Supabase incorreto para testes: SUPABASE_URL aponta para "${ref}", ` +
        `mas TEST_SUPABASE_PROJECT_REF e "${refEsperado}". Nenhuma operacao foi feita.`,
    );
  }
}
