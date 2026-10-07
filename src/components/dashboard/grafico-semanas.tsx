"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Indicadores } from "@/lib/indicadores";

const TITULO = "Novos leads por semana";

/** "2026-10-05" vira "05/10". */
function rotuloSemana(semanaInicio: string): string {
  const [, mes, dia] = semanaInicio.split("-");
  return `${dia}/${mes}`;
}

export function GraficoSemanas({ semanas }: { semanas: Indicadores["leadsPorSemana"] }) {
  const dados = semanas.map((s) => ({ semana: rotuloSemana(s.semanaInicio), total: s.total }));
  const descricao = `${TITULO}: ${dados.map((d) => `semana de ${d.semana}, ${d.total}`).join("; ")}.`;

  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="mb-4 text-base font-medium">{TITULO}</h2>
      <div role="img" aria-label={descricao} className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="semana" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
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
