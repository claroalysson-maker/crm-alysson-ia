import { Suspense } from "react";
import { ConteudoDashboard } from "./conteudo";

export default function PaginaDashboard() {
  return (
    <main className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando indicadores...</p>}>
        <ConteudoDashboard />
      </Suspense>
    </main>
  );
}
