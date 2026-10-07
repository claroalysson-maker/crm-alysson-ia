"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

/** Encerra a sessao deste navegador e volta ao login, mesmo que o signOut falhe. */
export async function sair(): Promise<void> {
  try {
    const db = await createServerClient();
    const { error } = await db.auth.signOut({ scope: "local" });
    if (error) console.error("Falha ao encerrar a sessão:", error.message);
  } catch (erro) {
    console.error("Falha ao encerrar a sessão:", (erro as Error).message);
  }
  redirect("/login");
}
