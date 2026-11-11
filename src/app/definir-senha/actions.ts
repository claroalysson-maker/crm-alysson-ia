"use server";

import { redirect } from "next/navigation";
import {
  ERRO_FALHA_TEMPORARIA,
  ERRO_SENHA_FRACA,
  ERRO_SENHA_IGUAL,
  ERRO_TROCA_INCOMPLETA,
  senhaSchema,
  type EstadoSenha,
} from "@/lib/senha-schema";
import { createServerClient } from "@/lib/supabase/server";
import { obterEstadoSessao } from "@/lib/supabase/session";

export async function definirSenha(_anterior: EstadoSenha, form: FormData): Promise<EstadoSenha> {
  const dados = senhaSchema.safeParse({
    senha: form.get("senha"),
    confirmacao: form.get("confirmacao"),
  });
  if (!dados.success) return { erro: dados.error.issues[0].message };

  let destino: string;
  try {
    const db = await createServerClient();
    const estado = await obterEstadoSessao(db);
    if (estado.tipo !== "valida") {
      destino = "/login";
    } else if (!estado.sessao.precisaTrocarSenha) {
      destino = "/dashboard";
    } else {
      const { error } = await db.auth.updateUser({ password: dados.data.senha });
      if (error) {
        if (error.code === "same_password") return { erro: ERRO_SENHA_IGUAL };
        if (error.code === "weak_password") return { erro: ERRO_SENHA_FRACA };
        console.error("Falha ao alterar a senha:", error.name, error.status, error.message);
        return { erro: ERRO_FALHA_TEMPORARIA };
      }
      const { error: erroConclusao } = await db.rpc("concluir_troca_senha");
      if (erroConclusao) {
        console.error("Falha ao concluir a troca de senha:", erroConclusao.message);
        return { erro: ERRO_TROCA_INCOMPLETA };
      }
      destino = "/dashboard";
    }
  } catch (erro) {
    console.error("Falha inesperada ao definir a senha:", (erro as Error).message);
    return { erro: ERRO_FALHA_TEMPORARIA };
  }
  // Fora do try: redirect lanca internamente e nao pode ser capturado como falha.
  redirect(destino);
}
