import { PainelForm } from "./painel-form";

export function EstadoVazio() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border p-10 text-center">
      <p className="text-sm text-muted-foreground">Você ainda não tem clientes cadastrados.</p>
      <PainelForm>Adicionar primeiro cliente</PainelForm>
    </div>
  );
}

export function SemResultados() {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <p className="text-sm text-muted-foreground">Nenhum resultado para esta busca.</p>
    </div>
  );
}

export function ErroNaLista() {
  return (
    <p
      role="alert"
      className="rounded-xl border border-border p-6 text-center text-sm text-destructive"
    >
      Não foi possível carregar os clientes. Tente novamente em instantes.
    </p>
  );
}
