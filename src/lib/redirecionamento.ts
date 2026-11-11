const ROTA_LOGIN = "/login";
const ROTA_INICIAL = "/dashboard";
const ROTA_DEFINIR_SENHA = "/definir-senha";

/** Decide para onde enviar a requisicao; null significa seguir normalmente. */
export function decidirRedirecionamento(
  pathname: string,
  temSessao: boolean,
  precisaTrocarSenha = false,
): string | null {
  const ehLogin = pathname === ROTA_LOGIN;
  if (!temSessao) return ehLogin ? null : ROTA_LOGIN;
  const ehDefinirSenha = pathname === ROTA_DEFINIR_SENHA;
  if (precisaTrocarSenha) return ehDefinirSenha ? null : ROTA_DEFINIR_SENHA;
  if (ehLogin || ehDefinirSenha || pathname === "/") return ROTA_INICIAL;
  return null;
}
