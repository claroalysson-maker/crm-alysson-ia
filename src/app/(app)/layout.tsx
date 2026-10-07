import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { MenuLateral } from "@/components/menu-lateral";
import { obterSessao, type Sessao } from "@/lib/supabase/session";
import { createServerClient } from "@/lib/supabase/server";

async function carregarSessao(): Promise<Sessao | null | undefined> {
  // Fora do try: o prerender precisa ser adiado, nunca capturado como erro de sessao.
  await connection();
  try {
    return await obterSessao(await createServerClient());
  } catch (erro) {
    console.error("Falha ao validar a sessão no layout:", (erro as Error).message);
    return undefined;
  }
}

async function CascaDoApp({ children }: { children: ReactNode }) {
  const sessao = await carregarSessao();

  if (sessao === undefined) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p role="alert" className="max-w-sm text-center text-sm text-muted-foreground">
          Não foi possível carregar sua sessão agora. Recarregue a página em instantes.
        </p>
      </main>
    );
  }
  // O proxy ja redireciona antes; aqui e defesa em profundidade.
  if (sessao === null) redirect("/login");

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <MenuLateral />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export default function LayoutDoApp({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <CascaDoApp>{children}</CascaDoApp>
    </Suspense>
  );
}
