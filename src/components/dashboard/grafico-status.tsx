"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ROTULO_STATUS } from "@/lib/clientes/formato";
import { STATUS, type Status } from "@/lib/clientes/schema";

const TITULO = "Distribuição por status";

const COR: Record<Status, string> = {
  lead: "var(--chart-1)",
  cliente: "var(--chart-3)",
  perdido: "var(--chart-5)",
};

export function GraficoStatus({ porStatus }: { porStatus: Record<Status, number> }) {
  const dados = STATUS.map((status) => ({
    status,
    nome: ROTULO_STATUS[status],
    total: porStatus[status],
  }));
  const descricao = `${TITULO}: ${dados.map((d) => `${d.nome} ${d.total}`).join(", ")}.`;

  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="mb-4 text-base font-medium">{TITULO}</h2>
      <div role="img" aria-label={descricao} className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dados}
              dataKey="total"
              nameKey="nome"
              innerRadius="60%"
              outerRadius="90%"
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {dados.map((d) => (
                <Cell key={d.status} fill={COR[d.status]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {dados.map((d) => (
          <li key={d.status} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block size-3 rounded-sm"
                style={{ background: COR[d.status] }}
              />
              {d.nome}
            </span>
            <span className="tabular-nums text-muted-foreground">{d.total}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
