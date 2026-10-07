import { z } from "zod";
import { clienteSchema, type ClienteInput } from "./schema";

export type EstadoForm = {
  ok?: true;
  erros?: Record<string, string>;
  /** Valores digitados, devolvidos em caso de erro para repreencher o formulario. */
  valores?: Record<string, string>;
};

export const ERRO_SALVAR = "Não foi possível salvar. Tente novamente.";
export const ERRO_CLIENTE_INVALIDO = "Cliente inválido. Recarregue a página.";

const CAMPOS = [
  "nome",
  "email",
  "telefone",
  "empresa_contato",
  "status",
  "valor_estimado",
  "notas",
] as const;

const MENSAGENS: Record<string, string> = {
  nome: "Informe o nome",
  email: "Informe um e-mail válido",
  telefone: "Telefone muito longo",
  empresa_contato: "Nome da empresa muito longo",
  status: "Selecione um status válido",
  valor_estimado: "Informe um valor válido, como 1500,50",
  notas: "Notas muito longas",
};
export const ERRO_DECIMAIS = "Use no máximo 2 casas decimais";

const MAIS_DE_2_DECIMAIS = /^\d+[.,]\d{3,}$/;
const DECIMAL_COM_VIRGULA = /^\d+,\d{1,2}$/;

export type ResultadoAnalise =
  | { ok: true; id?: string; dados: ClienteInput }
  | { ok: false; erros: Record<string, string>; valores: Record<string, string> };

function texto(form: FormData, campo: string): string {
  const valor = form.get(campo);
  return typeof valor === "string" ? valor : "";
}

/** Aceita virgula como separador decimal ("1500,5"); o restante segue o schema. */
function normalizarValor(valor: string): string {
  const aparado = valor.trim();
  return DECIMAL_COM_VIRGULA.test(aparado) ? aparado.replace(",", ".") : aparado;
}

export function analisarFormulario(form: FormData): ResultadoAnalise {
  const valores = Object.fromEntries(CAMPOS.map((c) => [c, texto(form, c)]));
  const erros: Record<string, string> = {};

  const idBruto = texto(form, "id");
  if (idBruto && !z.uuid().safeParse(idBruto).success) {
    erros._form = ERRO_CLIENTE_INVALIDO;
  }

  if (MAIS_DE_2_DECIMAIS.test(valores.valor_estimado.trim())) {
    erros.valor_estimado = ERRO_DECIMAIS;
  }

  const analise = clienteSchema.safeParse({
    ...valores,
    valor_estimado: normalizarValor(valores.valor_estimado),
  });
  if (!analise.success) {
    for (const problema of analise.error.issues) {
      const campo = String(problema.path[0] ?? "_form");
      erros[campo] ??= MENSAGENS[campo] ?? ERRO_SALVAR;
    }
  }

  if (Object.keys(erros).length > 0 || !analise.success) {
    return { ok: false, erros, valores };
  }
  return { ok: true, id: idBruto || undefined, dados: analise.data };
}
