import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EstadoVazioDashboard() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border p-10 text-center">
      <p className="text-sm text-muted-foreground">
        Você ainda não tem clientes. Cadastre o primeiro para ver seus indicadores.
      </p>
      <Link href="/clientes" className={cn(buttonVariants())}>
        Adicionar primeiro cliente
      </Link>
    </div>
  );
}

export function ErroNoDashboard() {
  return (
    <p
      role="alert"
      className="rounded-xl border border-border p-6 text-center text-sm text-destructive"
    >
      Não foi possível carregar os indicadores. Tente novamente em instantes.
    </p>
  );
}
