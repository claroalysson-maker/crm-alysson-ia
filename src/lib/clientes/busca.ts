/**
 * Unico lugar que monta o padrao de busca de clientes para o PostgREST.
 *
 * O filtro `.or("nome.ilike.<padrao>,email.ilike.<padrao>")` passa por duas
 * camadas de interpretacao, e o termo digitado precisa sobreviver a ambas
 * como texto literal:
 *
 * 1. Gramatica do PostgREST (separa condicoes por `,` e agrupa com `(`/`)`):
 *    um valor entre aspas duplas pode conter `,`, `(` e `)` sem efeito; dentro
 *    das aspas, barra invertida + aspas e barra dupla representam aspas e
 *    barra literais.
 * 2. LIKE do Postgres: `%` e `_` sao curingas; uma barra invertida os escapa
 *    e a barra dupla e a barra literal. Como o escape do LIKE passa antes pelo
 *    desescape das aspas, cada barra do LIKE precisa ser dobrada.
 *
 * Caso especial: o PostgREST troca `*` por `%` em valores de like/ilike e nao
 * ha como escapar esse `*`; ele vira `_` (um caractere qualquer). Assim `a*b`
 * casa com o literal `a*b`, mas tambem com `axb`, e um `*` sozinho casa todo
 * nome nao vazio da propria empresa (nunca de outra: a RLS continua valendo).
 */
const BARRA = "\\";

export function escaparTermoBusca(termo: string): string {
  const literalParaLike = termo
    .replaceAll(BARRA, BARRA + BARRA)
    .replaceAll("%", BARRA + "%")
    .replaceAll("_", BARRA + "_")
    .replaceAll("*", "_");
  const literalParaAspas = literalParaLike
    .replaceAll(BARRA, BARRA + BARRA)
    .replaceAll('"', BARRA + '"');
  return `"%${literalParaAspas}%"`;
}

/** Expressao para `.or(...)`: busca parcial, sem diferenciar caixa, em nome OU e-mail. */
export function expressaoBusca(termo: string): string {
  const padrao = escaparTermoBusca(termo);
  return `nome.ilike.${padrao},email.ilike.${padrao}`;
}
