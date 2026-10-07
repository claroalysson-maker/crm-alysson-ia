export type ResultadoRemocao = { ok?: true; erro?: string };

export const ERRO_EXCLUIR = "Não foi possível excluir. Tente novamente.";

/**
 * Chama a acao de remocao e nunca rejeita: uma excecao (ex.: rede) vira a mensagem amigavel
 * em vez de uma promise rejeitada sem tratamento dentro da transicao.
 */
export async function confirmarExclusao(
  remover: (id: string) => Promise<ResultadoRemocao>,
  id: string,
): Promise<ResultadoRemocao> {
  try {
    return await remover(id);
  } catch (erro) {
    console.error("Falha ao chamar a exclusao de cliente:", (erro as Error).message);
    return { erro: ERRO_EXCLUIR };
  }
}

/** Durante a exclusao pendente, fechar o dialogo (Esc/overlay) e ignorado. */
export function podeAlterarAbertura(novoAberto: boolean, pendente: boolean): boolean {
  return novoAberto || !pendente;
}
