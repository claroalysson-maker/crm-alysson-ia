import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { STATUS, type Status } from "@/lib/clientes/schema";

export const SEMANAS_NO_GRAFICO = 8;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const MENSAGEM_ERRO = "Não foi possível carregar os indicadores.";

const contagem = z.number().int().nonnegative();

const brutosSchema = z.object({
  contagens: z.object({ lead: contagem, cliente: contagem, perdido: contagem }),
  // numeric pode chegar como string em alguns clientes; coerce cobre os dois casos.
  valor_em_negociacao: z.coerce.number().nonnegative(),
  leads_por_semana: z.array(
    z.object({
      semana_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      total: contagem,
    }),
  ),
});

export type IndicadoresBrutos = z.infer<typeof brutosSchema>;

export type Indicadores = {
  totalLeads: number;
  totalClientes: number;
  taxaConversao: number;
  valorEmNegociacao: number;
  leadsPorSemana: { semanaInicio: string; total: number }[];
  porStatus: Record<Status, number>;
};

/** Segunda-feira (UTC) da semana de `data`. */
function segundaDaSemana(data: Date): Date {
  const dia = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
  const diasDesdeSegunda = (dia.getUTCDay() + 6) % 7;
  return new Date(dia.getTime() - diasDesdeSegunda * MS_POR_DIA);
}

/** As 8 segundas-feiras da janela (YYYY-MM-DD), da mais antiga para a semana atual. */
function semanasDaJanela(agora: Date): string[] {
  const atual = segundaDaSemana(agora).getTime();
  return Array.from({ length: SEMANAS_NO_GRAFICO }, (_, i) =>
    new Date(atual - (SEMANAS_NO_GRAFICO - 1 - i) * 7 * MS_POR_DIA).toISOString().slice(0, 10),
  );
}

export function montarIndicadores(bruto: IndicadoresBrutos, agora: Date): Indicadores {
  const porStatus = Object.fromEntries(
    STATUS.map((status) => [status, bruto.contagens[status]]),
  ) as Record<Status, number>;

  const totalLeads = porStatus.lead;
  const totalClientes = porStatus.cliente;
  const base = totalLeads + totalClientes;

  const totaisPorSemana = new Map(bruto.leads_por_semana.map((s) => [s.semana_inicio, s.total]));

  return {
    totalLeads,
    totalClientes,
    taxaConversao: base === 0 ? 0 : totalClientes / base,
    valorEmNegociacao: bruto.valor_em_negociacao,
    leadsPorSemana: semanasDaJanela(agora).map((semanaInicio) => ({
      semanaInicio,
      total: totaisPorSemana.get(semanaInicio) ?? 0,
    })),
    porStatus,
  };
}

export async function buscarIndicadores(
  db: SupabaseClient,
  agora: Date = new Date(),
): Promise<Indicadores> {
  const { data, error } = await db.rpc("indicadores_empresa", { p_agora: agora.toISOString() });
  if (error) {
    console.error("Falha ao buscar indicadores:", error.message);
    throw new Error(MENSAGEM_ERRO);
  }
  const analisado = brutosSchema.safeParse(data);
  if (!analisado.success) {
    console.error("Resposta inesperada dos indicadores:", analisado.error.message);
    throw new Error(MENSAGEM_ERRO);
  }
  return montarIndicadores(analisado.data, agora);
}

const PERCENTUAL = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});

export function formatarPercentual(fracao: number): string {
  if (!Number.isFinite(fracao) || fracao < 0) return PERCENTUAL.format(0);
  return PERCENTUAL.format(fracao);
}
