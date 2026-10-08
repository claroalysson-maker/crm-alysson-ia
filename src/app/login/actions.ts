"use server";

import { redirect } from "next/navigation";
import { autenticar, ERRO_FALHA_TEMPORARIA } from "@/lib/login";
import { loginSchema, type EstadoLogin } from "@/lib/login-schema";
import { createServerClient } from "@/lib/supabase/server";

export async function entrar(_anterior: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const bruto = form.get("email");
  const email = typeof bruto === "string" ? bruto.trim().toLowerCase() : "";

  const dados = loginSchema.safeParse({ email: bruto, senha: form.get("senha") });
  if (!dados.success) return { erro: "Informe um e-mail e uma senha válidos", email };

  let resultado: { erro?: string };
  try {
    resultado = await autenticar(await createServerClient(), dados.data.email, dados.data.senha);
  } catch (erro) {
    console.error("Falha ao iniciar o login:", (erro as Error).message);
    return { erro: ERRO_FALHA_TEMPORARIA, email: dados.data.email };
  }
  if (resultado.erro) return { erro: resultado.erro, email: dados.data.email };

  redirect("/dashboard");
}
