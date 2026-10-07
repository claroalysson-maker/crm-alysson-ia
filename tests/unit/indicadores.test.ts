import { describe, expect, it, vi } from "vitest";
import {
  buscarIndicadores,
  formatarPercentual,
  montarIndicadores,
  type IndicadoresBrutos,
} from "@/lib/indicadores";

const AGORA = new Date("2026-10-07T15:00:00Z"); // quarta-feira; semana atual comeca em 2026-10-05

const SEMANAS_ESPERADAS = [
  "2026-08-17",
  "2026-08-24",
  "2026-08-31",
  "2026-09-07",
  "2026-09-14",
  "2026-09-21",
  "2026-09-28",
  "2026-10-05",
];

function bruto(parcial: Partial<IndicadoresBrutos> = {}): IndicadoresBrutos {
  return {
    contagens: { lead: 0, cliente: 0, perdido: 0 },
    valor_em_negociacao: 0,
    leads_por_semana: [],
    ...parcial,
  };
}

describe("montarIndicadores", () => {
  it("devolve tudo zerado e 8 semanas vazias para bruto vazio", () => {
    const r = montarIndicadores(bruto(), AGORA);
    expect(r.totalLeads).toBe(0);
    expect(r.totalClientes).toBe(0);
    expect(r.taxaConversao).toBe(0);
    expect(r.valorEmNegociacao).toBe(0);
    expect(r.porStatus).toEqual({ lead: 0, cliente: 0, perdido: 0 });
    expect(r.leadsPorSemana).toHaveLength(8);
    expect(r.leadsPorSemana.every((s) => s.total === 0)).toBe(true);
  });

  it("com so perdidos, taxa e valor sao 0", () => {
    const r = montarIndicadores(bruto({ contagens: { lead: 0, cliente: 0, perdido: 4 } }), AGORA);
    expect(r.taxaConversao).toBe(0);
    expect(r.valorEmNegociacao).toBe(0);
    expect(r.porStatus.perdido).toBe(4);
  });

  it("calcula totais, taxa (clientes / (leads + clientes)) e valor", () => {
    const r = montarIndicadores(
      bruto({ contagens: { lead: 3, cliente: 1, perdido: 1 }, valor_em_negociacao: 350 }),
      AGORA,
    );
    expect(r.totalLeads).toBe(3);
    expect(r.totalClientes).toBe(1);
    expect(r.taxaConversao).toBe(0.25);
    expect(r.valorEmNegociacao).toBe(350);
    expect(r.porStatus).toEqual({ lead: 3, cliente: 1, perdido: 1 });
  });

  it("preenche 8 semanas ordenadas (segunda-feira UTC), com 0 onde falta", () => {
    const r = montarIndicadores(
      bruto({
        leads_por_semana: [
          { semana_inicio: "2026-10-05", total: 2 },
          { semana_inicio: "2026-09-14", total: 5 },
        ],
      }),
      AGORA,
    );
    expect(r.leadsPorSemana.map((s) => s.semanaInicio)).toEqual(SEMANAS_ESPERADAS);
    expect(r.leadsPorSemana.map((s) => s.total)).toEqual([0, 0, 0, 0, 5, 0, 0, 2]);
  });

  it("usa a segunda-feira UTC quando agora cai num domingo", () => {
    const r = montarIndicadores(bruto(), new Date("2026-10-11T23:59:59Z"));
    expect(r.leadsPorSemana.at(-1)?.semanaInicio).toBe("2026-10-05");
  });

  it("ignora semanas fora da janela", () => {
    const r = montarIndicadores(
      bruto({
        leads_por_semana: [
          { semana_inicio: "2026-08-10", total: 9 },
          { semana_inicio: "2026-10-12", total: 9 },
          { semana_inicio: "2026-10-05", total: 1 },
        ],
      }),
      AGORA,
    );
    expect(r.leadsPorSemana.map((s) => s.total)).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
  });
});

describe("formatarPercentual", () => {
  it.each([
    [0.25, "25%"],
    [0, "0%"],
    [1, "100%"],
    [0.3333, "33%"],
    [0.005, "1%"],
    [Number.NaN, "0%"],
    [-0.5, "0%"],
    [Number.POSITIVE_INFINITY, "0%"],
  ])("formata %s como %s", (entrada, saida) => {
    expect(formatarPercentual(entrada)).toBe(saida);
  });
});

describe("buscarIndicadores", () => {
  const dbCom = (resposta: { data: unknown; error: unknown }) => {
    const rpc = vi.fn().mockResolvedValue(resposta);
    return { db: { rpc } as never, rpc };
  };

  it("chama a funcao do banco com p_agora e monta o resultado", async () => {
    const { db, rpc } = dbCom({
      data: bruto({ contagens: { lead: 1, cliente: 1, perdido: 0 }, valor_em_negociacao: 10 }),
      error: null,
    });
    const r = await buscarIndicadores(db, AGORA);
    expect(rpc).toHaveBeenCalledWith("indicadores_empresa", { p_agora: AGORA.toISOString() });
    expect(r.taxaConversao).toBe(0.5);
  });

  it("aceita valor numerico vindo como string do banco", async () => {
    const { db } = dbCom({ data: bruto({ valor_em_negociacao: "12.50" as never }), error: null });
    expect((await buscarIndicadores(db, AGORA)).valorEmNegociacao).toBe(12.5);
  });

  it("lanca erro em portugues e loga o detalhe quando o banco falha", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = dbCom({ data: null, error: { message: "boom tecnico" } });
    await expect(buscarIndicadores(db, AGORA)).rejects.toThrow(/indicadores/i);
    expect(log).toHaveBeenCalledWith(expect.any(String), "boom tecnico");
    log.mockRestore();
  });

  it("lanca erro quando o payload e malformado", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = dbCom({ data: { contagens: { lead: "x" } }, error: null });
    await expect(buscarIndicadores(db, AGORA)).rejects.toThrow(/indicadores/i);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
