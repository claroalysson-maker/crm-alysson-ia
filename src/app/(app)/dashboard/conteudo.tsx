import { connection } from "next/server";
import { CartoesIndicadores } from "@/components/dashboard/cartoes";
import { EstadoVazioDashboard, ErroNoDashboard } from "@/components/dashboard/estados";
import { GraficoSemanas } from "@/components/dashboard/grafico-semanas";
import { GraficoStatus } from "@/components/dashboard/grafico-status";
import { ErroIndicadores, buscarIndicadores, type Indicadores } from "@/lib/indicadores";
import { createServerClient } from "@/lib/supabase/server";

async function carregar(): Promise<Indicadores | null> {
  // Fora do try: o prerender precisa ser adiado, nunca capturado como erro.
  await connection();
  try {
    return await buscarIndicadores(await createServerClient());
  } catch (erro) {
    // buscarIndicadores ja registra o detalhe; so registra aqui o que nao passou por ele.
    if (!(erro instanceof ErroIndicadores)) {
      console.error("Falha ao carregar o dashboard:", (erro as Error).message);
    }
    return null;
  }
}

export async function ConteudoDashboard() {
  const indicadores = await carregar();
  if (!indicadores) return <ErroNoDashboard />;

  const total = Object.values(indicadores.porStatus).reduce((soma, n) => soma + n, 0);
  if (total === 0) return <EstadoVazioDashboard />;

  return (
    <>
      <CartoesIndicadores indicadores={indicadores} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GraficoSemanas semanas={indicadores.leadsPorSemana} />
        </div>
        <GraficoStatus porStatus={indicadores.porStatus} />
      </div>
    </>
  );
}
