import type { Status } from "./schema";

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const ROTULO_STATUS: Record<Status, string> = {
  lead: "Lead",
  cliente: "Cliente",
  perdido: "Perdido",
};

export function formatarMoeda(valor: number | string): string {
  return MOEDA.format(Number(valor));
}
