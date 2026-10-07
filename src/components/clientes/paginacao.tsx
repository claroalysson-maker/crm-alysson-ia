import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ParametrosClientes } from "@/lib/clientes/parametros";

type Filtros = Pick<ParametrosClientes, "busca" | "status">;
type Props = Filtros & { pagina: number; totalPaginas: number };

export function hrefDaPagina({ busca, status }: Filtros, pagina: number): string {
  const params = new URLSearchParams();
  if (busca) params.set("busca", busca);
  if (status) params.set("status", status);
  if (pagina > 1) params.set("pagina", String(pagina));
  const consulta = params.toString();
  return consulta ? `/clientes?${consulta}` : "/clientes";
}

function Passo({ href, children }: { href?: string; children: string }) {
  if (!href) {
    return (
      <Button variant="outline" disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button variant="outline" nativeButton={false} render={<Link href={href} />}>
      {children}
    </Button>
  );
}

export function Paginacao({ pagina, totalPaginas, busca, status }: Props) {
  const filtros = { busca, status };
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-2">
      <Passo href={pagina > 1 ? hrefDaPagina(filtros, pagina - 1) : undefined}>Anterior</Passo>
      <span className="text-sm text-muted-foreground">
        Página {pagina} de {totalPaginas}
      </span>
      <Passo href={pagina < totalPaginas ? hrefDaPagina(filtros, pagina + 1) : undefined}>
        Próxima
      </Passo>
    </nav>
  );
}
