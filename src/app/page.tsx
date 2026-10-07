import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/supabase/session";

async function Redirecionar(): Promise<null> {
  const sessao = await obterSessao(await createServerClient());
  redirect(sessao ? "/dashboard" : "/login");
  return null;
}

export default function PaginaInicial() {
  return (
    <Suspense fallback={null}>
      <Redirecionar />
    </Suspense>
  );
}
