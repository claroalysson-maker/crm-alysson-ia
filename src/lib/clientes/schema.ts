import { z } from "zod";

export const STATUS = ["lead", "cliente", "perdido"] as const;
export type Status = (typeof STATUS)[number];

const VALOR_MAXIMO = 9_999_999_999.99; // numeric(12, 2)
const EPSILON_CENTAVOS = 1e-6;

/** Texto opcional: aplica trim, limita o tamanho e converte vazio/ausente em null. */
function textoOpcional(maximo: number) {
  return z
    .string()
    .trim()
    .max(maximo)
    .nullish()
    .transform((valor) => (valor ? valor : null));
}

/** O formulario envia string: vazio/ausente vira 0; NaN e Infinity sao rejeitados. */
function paraNumero(entrada: unknown): unknown {
  if (entrada === undefined) return 0;
  if (typeof entrada !== "string") return entrada;
  const texto = entrada.trim();
  return texto === "" ? 0 : Number(texto);
}

const valorEstimado = z.preprocess(
  paraNumero,
  z
    .number()
    .finite()
    .min(0)
    .max(VALOR_MAXIMO)
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < EPSILON_CENTAVOS, {
      message: "No maximo 2 casas decimais",
    }),
);

export const clienteSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  email: z
    .string()
    .trim()
    .max(254)
    .nullish()
    .transform((valor) => (valor ? valor : null))
    .pipe(z.email().nullable()),
  telefone: textoOpcional(40),
  empresa_contato: textoOpcional(200),
  status: z.enum(STATUS),
  valor_estimado: valorEstimado,
  notas: textoOpcional(5000),
});

export type ClienteInput = z.infer<typeof clienteSchema>;

export type Cliente = ClienteInput & {
  id: string;
  empresa_id: string;
  criado_em: string;
  atualizado_em: string;
};
