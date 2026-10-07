import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { STATUS, type Status } from "@/lib/clientes/schema";

export const SEMANAS_NO_GRAFICO = 8;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const MENSAGEM_ERRO = "Não foi possível carregar os indicadores.";

/** Falha ja registrada (com o detalhe tecnico) por `buscarIndicadores`; quem captura nao registra de novo. */
export class ErroIndicadores extends Error {
  constructor() {
    super(MENSAGEM_ERRO);
    this.name = "ErroIndicadores";
  }
}

const contagem = z.number().int().nonnegative();

const brutosSchema = z.object({
  contagens: z.object({ lead: contagem, cliente: contagem, perdido: contagem }),
  // numeric pode chegar como numero JSON ou string decimal simples; null, "" e lixo sao rejeitados
  // (nada de coagir para 0, que esconderia um payload quebrado).
  valor_em_negociacao: z.union([
    z.number().nonnegative(),
    z.string().regex(/^\d+(\.\d+)?$/).transform(Number),
  ]),
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
    throw new ErroIndicadores();
  }
  const analisado = brutosSchema.safeParse(data);
  if (!analisado.success) {
    console.error("Resposta inesperada dos indicadores:", analisado.error.message);
    throw new ErroIndicadores();
  }
  return montarIndicadores(analisado.data, agora);
}

const MAIOR_FRACAO_ABAIXO_DE_UM = 0.99;

const PERCENTUAL = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});

/** Abaixo de 100% nunca arredonda para "100%" (0,995 vira "99%"); 100% ou mais vira "100%". */
export function formatarPercentual(fracao: number): string {
  if (!Number.isFinite(fracao) || fracao < 0) return PERCENTUAL.format(0);
  if (fracao >= 1) return PERCENTUAL.format(1);
  return PERCENTUAL.format(Math.min(fracao, MAIOR_FRACAO_ABAIXO_DE_UM));
}
