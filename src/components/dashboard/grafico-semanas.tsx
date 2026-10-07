"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Indicadores } from "@/lib/indicadores";

const TITULO = "Novos leads por semana";

/**
 * "2026-10-05" vira "05/10"; se as semanas cruzam a virada do ano, inclui o ano
 * ("29/12/25", "05/01/26") para o eixo nao ficar ambiguo.
 */
export function rotulosDasSemanas(semanas: Indicadores["leadsPorSemana"]): string[] {
  const partes = semanas.map((s) => s.semanaInicio.split("-"));
  const cruzaAno = new Set(partes.map(([ano]) => ano)).size > 1;
  return partes.map(([ano, mes, dia]) => (cruzaAno ? `${dia}/${mes}/${ano.slice(2)}` : `${dia}/${mes}`));
}

export function GraficoSemanas({ semanas }: { semanas: Indicadores["leadsPorSemana"] }) {
  const rotulos = rotulosDasSemanas(semanas);
  const dados = semanas.map((s, i) => ({ semana: rotulos[i], total: s.total }));
  const descricao = `${TITULO}: ${dados.map((d) => `semana de ${d.semana}, ${d.total}`).join("; ")}.`;

  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="mb-4 text-base font-medium">{TITULO}</h2>
      <div role="img" aria-label={descricao} className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="semana" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <YAxis
              allowDecimals={false}
              domain={[0, (max: number) => Math.max(max, 1)]}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--accent)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
              }}
              labelFormatter={(rotulo) => `Semana de ${rotulo}`}
              formatter={(valor) => [valor, "Novos leads"]}
            />
            <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{TITULO}</caption>
        <thead>
          <tr>
            <th scope="col">Semana (início)</th>
            <th scope="col">Novos leads</th>
          </tr>
        </thead>
        <tbody>
          {dados.map((d) => (
            <tr key={d.semana}>
              <th scope="row">{d.semana}</th>
              <td>{d.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
