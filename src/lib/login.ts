import type { SupabaseClient } from "@supabase/supabase-js";
import { obterEstadoSessao } from "@/lib/supabase/session";

export const ERRO_CREDENCIAIS = "E-mail ou senha incorretos";
export const ERRO_SEM_EMPRESA = "Sua conta não está vinculada a uma empresa";
export const ERRO_FALHA_TEMPORARIA = "Não foi possível entrar agora. Tente novamente.";

// email_not_confirmed usa a mesma mensagem para nao revelar se a conta existe.
const CODIGOS_CREDENCIAIS = new Set(["invalid_credentials", "email_not_confirmed"]);

export async function autenticar(
  db: SupabaseClient,
  email: string,
  senha: string,
): Promise<{ erro?: string }> {
  try {
    const { error } = await db.auth.signInWithPassword({ email, password: senha });
    if (error) {
      if (error.code && CODIGOS_CREDENCIAIS.has(error.code)) return { erro: ERRO_CREDENCIAIS };
      console.error("Falha tecnica no login:", error.name, error.status, error.message);
      return { erro: ERRO_FALHA_TEMPORARIA };
    }

    const estado = await obterEstadoSessao(db);
    if (estado.tipo === "valida") return {};
    // Sem perfil: conta nao vinculada. Sem usuario/sessao invalida logo apos o login e anomalo:
    // mensagem generica. Nos dois casos, limpa so a sessao deste navegador.
    const semPerfil = estado.tipo === "sem-perfil";
    const { error: erroSaida } = await db.auth.signOut({ scope: "local" });
    if (erroSaida) {
      console.error(`Falha ao encerrar a sessao ${semPerfil ? "sem perfil" : "invalida"} no login:`, erroSaida.message);
    }
    return { erro: semPerfil ? ERRO_SEM_EMPRESA : ERRO_FALHA_TEMPORARIA };
  } catch (erro) {
    console.error("Falha inesperada no login:", (erro as Error).message);
    return { erro: ERRO_FALHA_TEMPORARIA };
  }
}

const ERROS_DA_URL: Record<string, string> = { "sem-empresa": ERRO_SEM_EMPRESA };

/** Aceita apenas valores conhecidos; nada vindo da URL e refletido na pagina. */
export function erroDaUrl(valor: string | string[] | undefined): string | undefined {
  return typeof valor === "string" && Object.hasOwn(ERROS_DA_URL, valor)
    ? ERROS_DA_URL[valor]
    : undefined;
}
