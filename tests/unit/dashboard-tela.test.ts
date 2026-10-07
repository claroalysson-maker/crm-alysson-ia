import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const buscarIndicadores = vi.fn();

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => ({}) }));
vi.mock("@/lib/indicadores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/indicadores")>()),
  buscarIndicadores: (...a: unknown[]) => buscarIndicadores(...a),
}));
// Sem layout no SSR estático, o ResponsiveContainer não tem tamanho: troca por um div.
vi.mock("recharts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("recharts")>()),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

import { ConteudoDashboard } from "@/app/(app)/dashboard/conteudo";
import { ErroIndicadores, montarIndicadores } from "@/lib/indicadores";
import { GraficoSemanas, rotulosDasSemanas } from "@/components/dashboard/grafico-semanas";
import { GraficoStatus } from "@/components/dashboard/grafico-status";

const AGORA = new Date("2026-10-07T15:00:00Z");
const com = (lead: number, cliente: number, perdido: number, valor: number) =>
  montarIndicadores(
    {
      contagens: { lead, cliente, perdido },
      valor_em_negociacao: valor,
      leads_por_semana: [{ semana_inicio: "2026-10-05", total: lead + cliente + perdido }],
    },
    AGORA,
  );

async function renderizar(): Promise<string> {
  return renderToStaticMarkup(await ConteudoDashboard());
}

describe("dashboard", () => {
  beforeEach(() => {
    buscarIndicadores.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("mostra os quatro cartões com valores formatados e os dois gráficos", async () => {
    buscarIndicadores.mockResolvedValue(com(3, 1, 1, 1500));
    const html = await renderizar();
    for (const t of ["Total de leads", "Total de clientes", "Taxa de conversão", "Valor em negociação"]) {
      expect(html).toContain(t);
    }
    expect(html).toContain("25%");
    expect(html).toMatch(/R\$\s1\.500,00/);
    expect(html).toContain("Novos leads por semana");
    expect(html).toContain("Distribuição por status");
    expect(html).not.toContain("Adicionar primeiro cliente");
  });

  it("sem clientes mostra estado vazio com link e sem gráficos", async () => {
    buscarIndicadores.mockResolvedValue(com(0, 0, 0, 0));
    const html = await renderizar();
    expect(html).toContain("Adicionar primeiro cliente");
    expect(html).toContain('href="/clientes"');
    expect(html).not.toContain("Novos leads por semana");
    expect(html).not.toContain("Total de leads");
  });

  it("mostra mensagem amigável quando a busca falha", async () => {
    buscarIndicadores.mockRejectedValue(new Error("falha"));
    const html = await renderizar();
    expect(html).toContain('role="alert"');
    expect(html).toContain("Não foi possível carregar os indicadores");
  });

  it("falha de buscarIndicadores ja registrada pela lib nao e registrada de novo", async () => {
    buscarIndicadores.mockRejectedValue(new ErroIndicadores());
    await renderizar();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("falha fora de buscarIndicadores (ex.: criar o cliente) e registrada uma vez", async () => {
    buscarIndicadores.mockRejectedValue(new Error("sem cookies"));
    await renderizar();
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), "sem cookies");
  });
});

const rotuloAria = (html: string) => html.match(/role="img" aria-label="([^"]*)"/)?.[1];

describe("gráficos (render estático)", () => {
  it("gráfico de semanas descreve cada semana no aria-label e na tabela acessível", () => {
    const semanas = montarIndicadores(
      {
        contagens: { lead: 3, cliente: 0, perdido: 0 },
        valor_em_negociacao: 0,
        leads_por_semana: [
          { semana_inicio: "2026-10-05", total: 3 },
          { semana_inicio: "2026-09-28", total: 1 },
        ],
      },
      AGORA,
    ).leadsPorSemana;
    const html = renderToStaticMarkup(createElement(GraficoSemanas, { semanas }));
    expect(rotuloAria(html)).toBe(
      "Novos leads por semana: semana de 17/08, 0; semana de 24/08, 0; semana de 31/08, 0; " +
        "semana de 07/09, 0; semana de 14/09, 0; semana de 21/09, 0; semana de 28/09, 1; semana de 05/10, 3.",
    );
    expect(html).toContain('<th scope="row">05/10</th><td>3</td>');
    expect(html).toContain('<th scope="row">28/09</th><td>1</td>');
  });

  it("gráfico de status lista rótulo e contagem de cada status na legenda e no aria-label", () => {
    const html = renderToStaticMarkup(
      createElement(GraficoStatus, { porStatus: { lead: 5, cliente: 2, perdido: 1 } }),
    );
    expect(rotuloAria(html)).toBe("Distribuição por status: Lead 5, Cliente 2, Perdido 1.");
    expect(html).toMatch(/Lead<\/span><span class="[^"]*">5<\/span>/);
    expect(html).toMatch(/Cliente<\/span><span class="[^"]*">2<\/span>/);
    expect(html).toMatch(/Perdido<\/span><span class="[^"]*">1<\/span>/);
  });
});

describe("rotulosDasSemanas", () => {
  const semanas = (...inicios: string[]) => inicios.map((semanaInicio) => ({ semanaInicio, total: 0 }));

  it("usa dia/mês quando todas as semanas são do mesmo ano", () => {
    expect(rotulosDasSemanas(semanas("2026-09-28", "2026-10-05"))).toEqual(["28/09", "05/10"]);
  });

  it("inclui o ano quando as semanas cruzam a virada do ano", () => {
    expect(rotulosDasSemanas(semanas("2025-12-22", "2025-12-29", "2026-01-05"))).toEqual([
      "22/12/25",
      "29/12/25",
      "05/01/26",
    ]);
  });
});
