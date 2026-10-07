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
import { montarIndicadores } from "@/lib/indicadores";

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
});
