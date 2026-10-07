import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getEnv } from "@/lib/env";
import { decidirRedirecionamento } from "@/lib/redirecionamento";
import { obterEstadoSessao } from "@/lib/supabase/session";

export async function proxy(request: NextRequest) {
  const env = getEnv();
  let resposta = NextResponse.next({ request });
  let cabecalhos: Record<string, string> = {};

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista, headers) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        resposta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
        cabecalhos = headers ?? {};
        Object.entries(cabecalhos).forEach(([k, v]) => resposta.headers.set(k, v));
      },
    },
  });

  let sessaoValida = false;
  let destinoForcado: string | null = null;
  try {
    // Valida o token no Auth (getUser) e exige perfil: sessao valida = usuario + empresa.
    const estado = await obterEstadoSessao(supabase);
    sessaoValida = estado.tipo === "valida";
    if (estado.tipo === "sem-perfil") {
      // signOut limpa os cookies via setAll; sem isso /login e /dashboard entrariam em loop.
      await supabase.auth.signOut();
      destinoForcado = "/login?erro=sem-empresa";
    }
  } catch (erro) {
    // Falha fechada: sem sessao valida, e sem deslogar (pode ser falha temporaria).
    console.error("Falha ao verificar a sessao no proxy:", (erro as Error).message);
  }

  const destino = destinoForcado ?? decidirRedirecionamento(request.nextUrl.pathname, sessaoValida);
  if (!destino) return resposta;

  const redirecionamento = NextResponse.redirect(new URL(destino, request.url));
  resposta.cookies.getAll().forEach((c) => redirecionamento.cookies.set(c));
  Object.entries(cabecalhos).forEach(([k, v]) => redirecionamento.headers.set(k, v));
  return redirecionamento;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
