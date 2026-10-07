import { Suspense } from "react";
import { ConteudoClientes } from "./conteudo";

export default function PaginaClientes({ searchParams }: PageProps<"/clientes">) {
  return (
    <main className="flex flex-col gap-4 p-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando clientes...</p>}>
        <ConteudoClientes searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
