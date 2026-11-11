import { z } from "zod";

export const ERRO_SENHA_IGUAL = "A nova senha deve ser diferente da senha atual";
export const ERRO_SENHA_FRACA = "Escolha uma senha mais forte";
export const ERRO_FALHA_TEMPORARIA = "Não foi possível alterar a senha agora. Tente novamente.";
export const ERRO_TROCA_INCOMPLETA =
  "Sua senha foi alterada, mas não foi possível concluir. Tente novamente com outra nova senha.";

const LIMITE_BYTES_BCRYPT = 72;

// O limite do bcrypt (usado pelo Supabase Auth) e em bytes, nao em caracteres:
// acima disso a senha seria truncada, e acentos/emoji ocupam mais de 1 byte.
const cabeNoBcrypt = (s: string) => new TextEncoder().encode(s).length <= LIMITE_BYTES_BCRYPT;

export const senhaSchema = z
  .object({
    senha: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres")
      .refine(cabeNoBcrypt, "A senha é longa demais (máximo de 72 bytes; acentos contam mais de 1)"),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, {
    path: ["confirmacao"],
    message: "As senhas não conferem",
  });

export type EstadoSenha = { erro?: string };
