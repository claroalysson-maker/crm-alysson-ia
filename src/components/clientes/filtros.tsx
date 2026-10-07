import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROTULO_STATUS } from "@/lib/clientes/formato";
import type { ParametrosClientes } from "@/lib/clientes/parametros";
import { STATUS } from "@/lib/clientes/schema";

/** Formulario GET: busca e filtro de status viajam na URL; sem estado no cliente. */
export function FiltrosClientes({
  busca,
  status,
}: Pick<ParametrosClientes, "busca" | "status">) {
  const filtrando = busca !== "" || status !== undefined;
  return (
    <form method="get" action="/clientes" role="search" className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="busca">Buscar</Label>
        <Input
          id="busca"
          name="busca"
          type="search"
          placeholder="Nome ou e-mail"
          defaultValue={busca}
          className="w-56"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="filtro-status">Status</Label>
        <select
          id="filtro-status"
          name="status"
          defaultValue={status ?? ""}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Todos</option>
          {STATUS.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS[s]}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit">Buscar</Button>
      {filtrando && (
        <Button variant="ghost" nativeButton={false} render={<Link href="/clientes" />}>
          Limpar filtros
        </Button>
      )}
    </form>
  );
}
