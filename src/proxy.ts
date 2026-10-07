import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getEnv } from "@/lib/env";
import { decidirRedirecionamento } from "@/lib/redirecionamento";

export async function proxy(request: NextRequest) {
  const env = getEnv();
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        resposta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
      },
    },
  });

  // getUser valida o token no Auth; getSession so leria o cookie sem verificar.
  const { data } = await supabase.auth.getUser();
  const destino = decidirRedirecionamento(request.nextUrl.pathname, Boolean(data.user));
  if (!destino) return resposta;

  const redirecionamento = NextResponse.redirect(new URL(destino, request.url));
  resposta.cookies.getAll().forEach((c) => redirecionamento.cookies.set(c));
  return redirecionamento;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
