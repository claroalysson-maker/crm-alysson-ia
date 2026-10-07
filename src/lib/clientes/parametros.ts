import { STATUS, type Status } from "./schema";

type ValorBruto = string | string[] | undefined;

export type ParametrosClientes = {
  busca: string;
  status: Status | undefined;
  pagina: number;
};

function primeiro(valor: ValorBruto): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/** Le os parametros de URL de /clientes de forma tolerante: valores invalidos viram o padrao. */
export function lerParametrosClientes(
  bruto: Record<string, ValorBruto>,
): ParametrosClientes {
  const status = primeiro(bruto.status);
  const pagina = Number(primeiro(bruto.pagina));
  return {
    busca: primeiro(bruto.busca)?.trim() ?? "",
    status: (STATUS as readonly string[]).includes(status ?? "")
      ? (status as Status)
      : undefined,
    pagina: Number.isSafeInteger(pagina) && pagina > 0 ? pagina : 1,
  };
}
