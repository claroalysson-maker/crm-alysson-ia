import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decidirRedirecionamento } from "@/lib/redirecionamento";
import { obterEstadoSessao } from "@/lib/supabase/session";

const ROTA_LOGIN = "/login";
const DESTINO_SEM_EMPRESA = "/login?erro=sem-empresa";

type Cookie = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };

export type AdaptadorCookies = {
  getAll: () => { name: string; value: string }[];
  setAll: (lista: Cookie[], headers?: Record<string, string>) => void;
};

export type CriarCliente = (cookies: AdaptadorCookies) => SupabaseClient;

/**
 * Logica do proxy por requisicao: valida a sessao (usuario + perfil), repassa
 * cookies/headers renovados e decide o redirecionamento.
 */
export async function processarRequisicao(
  request: NextRequest,
  criarCliente: CriarCliente,
): Promise<NextResponse> {
  let resposta = NextResponse.next({ request });
  let cabecalhos: Record<string, string> = {};

  const supabase = criarCliente({
    getAll: () => request.cookies.getAll(),
    setAll: (lista, headers) => {
      lista.forEach(({ name, value }) => request.cookies.set(name, value));
      resposta = NextResponse.next({ request });
      lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
      cabecalhos = headers ?? {};
      Object.entries(cabecalhos).forEach(([k, v]) => resposta.headers.set(k, v));
    },
  });

  const pathname = request.nextUrl.pathname;
  let sessaoValida = false;
  let destinoForcado: string | null = null;
  try {
    // Valida o token no Auth (getUser) e exige perfil: sessao valida = usuario + empresa.
    const estado = await obterEstadoSessao(supabase);
    sessaoValida = estado.tipo === "valida";
    if (estado.tipo === "sem-perfil") {
      // Em /login nao redireciona: a pagina renderiza e um signOut falho nao gera loop.
      if (pathname !== ROTA_LOGIN) destinoForcado = DESTINO_SEM_EMPRESA;
      // signOut local limpa os cookies deste navegador via setAll, sem revogar outras sessoes.
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) console.error("Falha ao encerrar a sessao sem perfil:", error.message);
    }
  } catch (erro) {
    // Falha fechada: sem sessao valida, e sem deslogar (pode ser falha temporaria).
    console.error("Falha ao verificar a sessao no proxy:", (erro as Error).message);
  }

  const destino = destinoForcado ?? decidirRedirecionamento(pathname, sessaoValida);
  if (!destino) return resposta;

  const redirecionamento = NextResponse.redirect(new URL(destino, request.url));
  resposta.cookies.getAll().forEach((c) => redirecionamento.cookies.set(c));
  Object.entries(cabecalhos).forEach(([k, v]) => redirecionamento.headers.set(k, v));
  return redirecionamento;
}
