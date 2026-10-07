import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { expressaoBusca } from "./busca";
import { STATUS, type Cliente, type ClienteInput, type Status } from "./schema";

export const TAMANHO_PAGINA = 20;

// Tipada como string: evita que o supabase-js tente interpretar a lista em tempo de compilacao.
const COLUNAS: string =
  "id, empresa_id, nome, email, telefone, empresa_contato, status, valor_estimado, notas, criado_em, atualizado_em";

export function totalPaginasPara(total: number): number {
  return Math.max(1, Math.ceil(total / TAMANHO_PAGINA));
}

/** Escolhe exatamente os 7 campos editaveis; nunca repassa chaves extras ao banco. */
function payload(input: ClienteInput): ClienteInput {
  const {
    nome,
    email,
    telefone,
    empresa_contato,
    status,
    valor_estimado,
    notas,
  } = input;
  return {
    nome,
    email,
    telefone,
    empresa_contato,
    status,
    valor_estimado,
    notas,
  };
}

export type ListaClientes = {
  itens: Cliente[];
  total: number;
  pagina: number;
  totalPaginas: number;
};

export type ParametrosLista = {
  busca?: string;
  status?: Status;
  pagina?: number;
};

/** Registra o detalhe tecnico no servidor e devolve um erro com mensagem curta para a interface. */
function falha(
  mensagem: string,
  contexto: string,
  erro: PostgrestError,
): Error {
  console.error(`${contexto}:`, erro.code, erro.message);
  return new Error(mensagem);
}

function paginaValida(pagina: number | undefined): number {
  return typeof pagina === "number" && Number.isInteger(pagina) && pagina > 0
    ? pagina
    : 1;
}

function statusValido(status: unknown): status is Status {
  return (
    typeof status === "string" && (STATUS as readonly string[]).includes(status)
  );
}

// Contrato minimo do construtor de filtros do PostgREST; evita instanciar o tipo completo.
type Filtravel = {
  eq(coluna: string, valor: string): unknown;
  or(filtros: string): unknown;
};

function aplicarFiltros<Q extends Filtravel>(
  consulta: Q,
  { busca, status }: ParametrosLista,
): Q {
  let resultado = consulta;
  const termo = busca?.trim();
  if (termo) resultado = resultado.or(expressaoBusca(termo)) as Q;
  if (statusValido(status)) resultado = resultado.eq("status", status) as Q;
  return resultado;
}

export async function listarClientes(
  db: SupabaseClient,
  params: ParametrosLista,
): Promise<ListaClientes> {
  const baseContagem = db
    .from("clientes")
    .select("id", { count: "exact", head: true });
  const contagem = await aplicarFiltros(baseContagem, params);
  if (contagem.error) {
    throw falha(
      "Não foi possível listar os clientes.",
      "Falha ao contar clientes",
      contagem.error,
    );
  }

  const total = contagem.count ?? 0;
  const totalPaginas = totalPaginasPara(total);
  const pagina = Math.min(paginaValida(params.pagina), totalPaginas);
  if (total === 0) return { itens: [], total, pagina, totalPaginas };

  const inicio = (pagina - 1) * TAMANHO_PAGINA;
  const { data, error } = await aplicarFiltros(
    db.from("clientes").select<string, Cliente>(COLUNAS),
    params,
  )
    .order("criado_em", { ascending: false })
    .order("id", { ascending: false })
    .range(inicio, inicio + TAMANHO_PAGINA - 1);
  if (error)
    throw falha(
      "Não foi possível listar os clientes.",
      "Falha ao listar clientes",
      error,
    );

  return { itens: data, total, pagina, totalPaginas };
}

export async function criarCliente(
  db: SupabaseClient,
  input: ClienteInput,
): Promise<Cliente> {
  const { data, error } = await db
    .from("clientes")
    .insert(payload(input))
    .select<string, Cliente>(COLUNAS)
    .single();
  if (error)
    throw falha(
      "Não foi possível criar o cliente.",
      "Falha ao criar cliente",
      error,
    );
  return data;
}

export async function atualizarCliente(
  db: SupabaseClient,
  id: string,
  input: ClienteInput,
): Promise<Cliente> {
  const { data, error } = await db
    .from("clientes")
    .update(payload(input))
    .eq("id", id)
    .select<string, Cliente>(COLUNAS)
    .single();
  if (error) {
    throw falha(
      "Não foi possível atualizar o cliente.",
      "Falha ao atualizar cliente",
      error,
    );
  }
  return data;
}

export async function excluirCliente(
  db: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await db.from("clientes").delete().eq("id", id);
  if (error)
    throw falha(
      "Não foi possível excluir o cliente.",
      "Falha ao excluir cliente",
      error,
    );
}
