"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ERRO_CLIENTE_INVALIDO,
  ERRO_SALVAR,
  analisarFormulario,
  type EstadoForm,
} from "@/lib/clientes/formulario";
import { ERRO_EXCLUIR, type ResultadoRemocao } from "@/lib/clientes/exclusao";
import {
  atualizarCliente,
  criarCliente,
  excluirCliente,
} from "@/lib/clientes/repositorio";
import { createServerClient } from "@/lib/supabase/server";

// Seguranca entre empresas: a autoridade e o RLS do banco (policies por empresa_id). As acoes
// usam o cliente Supabase do usuario e nao filtram por empresa; nao ha checagem de tenant aqui.
export type EstadoRemocao = ResultadoRemocao;

function revalidarTelas(): void {
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
}

export async function salvarCliente(
  _anterior: EstadoForm,
  form: FormData,
): Promise<EstadoForm> {
  const analise = analisarFormulario(form);
  if (!analise.ok) return { erros: analise.erros, valores: analise.valores };

  try {
    const db = await createServerClient();
    if (analise.id) await atualizarCliente(db, analise.id, analise.dados);
    else await criarCliente(db, analise.dados);
  } catch (erro) {
    console.error("Falha ao salvar cliente:", (erro as Error).message);
    return { erros: { _form: ERRO_SALVAR } };
  }

  revalidarTelas();
  return { ok: true };
}

export async function removerCliente(id: string): Promise<EstadoRemocao> {
  if (!z.uuid().safeParse(id).success) return { erro: ERRO_CLIENTE_INVALIDO };

  try {
    await excluirCliente(await createServerClient(), id);
  } catch (erro) {
    console.error("Falha ao excluir cliente:", (erro as Error).message);
    return { erro: ERRO_EXCLUIR };
  }

  revalidarTelas();
  return { ok: true };
}
