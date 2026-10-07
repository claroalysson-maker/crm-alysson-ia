const ROTA_LOGIN = "/login";
const ROTA_INICIAL = "/dashboard";

/** Decide para onde enviar a requisicao; null significa seguir normalmente. */
export function decidirRedirecionamento(pathname: string, temSessao: boolean): string | null {
  const ehLogin = pathname === ROTA_LOGIN;
  if (!temSessao) return ehLogin ? null : ROTA_LOGIN;
  if (ehLogin || pathname === "/") return ROTA_INICIAL;
  return null;
}
