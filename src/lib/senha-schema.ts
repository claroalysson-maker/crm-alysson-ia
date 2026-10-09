import { z } from "zod";

export const ERRO_SENHA_IGUAL = "A nova senha deve ser diferente da senha atual";
export const ERRO_SENHA_FRACA = "Escolha uma senha mais forte";
export const ERRO_FALHA_TEMPORARIA = "Não foi possível alterar a senha agora. Tente novamente.";
export const ERRO_TROCA_INCOMPLETA =
  "Sua senha foi alterada, mas não foi possível concluir. Tente novamente com outra nova senha.";

// 72 e o limite do bcrypt usado pelo Supabase Auth: acima disso a senha seria truncada.
export const senhaSchema = z
  .object({
    senha: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres")
      .max(72, "A senha deve ter no máximo 72 caracteres"),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, {
    path: ["confirmacao"],
    message: "As senhas não conferem",
  });

export type EstadoSenha = { erro?: string };
