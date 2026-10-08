import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarMoeda } from "@/lib/clientes/formato";
import { formatarPercentual, type Indicadores } from "@/lib/indicadores";

type Item = { titulo: string; valor: string };

export function CartoesIndicadores({ indicadores }: { indicadores: Indicadores }) {
  const itens: Item[] = [
    { titulo: "Total de leads", valor: String(indicadores.totalLeads) },
    { titulo: "Total de clientes", valor: String(indicadores.totalClientes) },
    { titulo: "Taxa de conversão", valor: formatarPercentual(indicadores.taxaConversao) },
    { titulo: "Valor em negociação", valor: formatarMoeda(indicadores.valorEmNegociacao) },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {itens.map((item) => (
        <Card key={item.titulo}>
          <CardHeader>
            <CardTitle className="text-muted-foreground">{item.titulo}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{item.valor}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
