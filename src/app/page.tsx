import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { destinoInicial } from "@/lib/supabase/destino-inicial";

async function Redirecionar(): Promise<never> {
  return redirect(await destinoInicial(await createServerClient()));
}

export default function PaginaInicial() {
  return (
    <Suspense fallback={null}>
      <Redirecionar />
    </Suspense>
  );
}
