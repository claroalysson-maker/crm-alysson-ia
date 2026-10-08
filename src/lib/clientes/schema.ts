import { z } from "zod";

export const STATUS = ["lead", "cliente", "perdido"] as const;
export type Status = (typeof STATUS)[number];

const VALOR_MAXIMO = 9_999_999_999.99; // numeric(12, 2)
const DECIMAL_SIMPLES = /^\d+(\.\d{1,2})?$/;

/** Texto opcional: aplica trim, limita o tamanho e converte vazio/ausente em null. */
function textoOpcional(maximo: number) {
  return z
    .string()
    .trim()
    .max(maximo)
    .nullish()
    .transform((valor) => (valor ? valor : null));
}

/**
 * O formulario envia string: vazio/ausente vira 0. Strings so valem como
 * decimal simples com ate 2 casas ("12", "12.5"); hex, binario, notacao
 * cientifica, virgula e sinal viram NaN e sao rejeitados.
 */
function paraNumero(entrada: unknown): unknown {
  if (entrada === undefined) return 0;
  if (typeof entrada !== "string") return entrada;
  const texto = entrada.trim();
  if (texto === "") return 0;
  return DECIMAL_SIMPLES.test(texto) ? Number(texto) : Number.NaN;
}

const valorEstimado = z.preprocess(
  paraNumero,
  z
    .number()
    .finite()
    .min(0)
    .max(VALOR_MAXIMO)
    .refine((v) => !Object.is(v, -0), { message: "Valor invalido" })
    .refine((v) => Number(v.toFixed(2)) === v, {
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
