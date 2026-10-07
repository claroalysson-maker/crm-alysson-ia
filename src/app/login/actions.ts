"use server";

import { redirect } from "next/navigation";
import { autenticar } from "@/lib/login";
import { loginSchema, type EstadoLogin } from "@/lib/login-schema";
import { createServerClient } from "@/lib/supabase/server";

export async function entrar(_anterior: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const dados = loginSchema.safeParse({
    email: form.get("email"),
    senha: form.get("senha"),
  });
  if (!dados.success) return { erro: "Informe um e-mail e uma senha válidos" };

  const resultado = await autenticar(await createServerClient(), dados.data.email, dados.data.senha);
  if (resultado.erro) return resultado;

  redirect("/dashboard");
}
