import { Button } from "@/components/ui/button";

/** Mensagem amigavel de erro inesperado: nenhum detalhe tecnico e exibido. */
export function ErroGenerico({ aoTentarNovamente }: { aoTentarNovamente: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div role="alert" className="flex max-w-sm flex-col items-center gap-4 text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="text-sm text-muted-foreground">
          Não foi possível concluir a operação agora. Tente novamente em instantes.
        </p>
        <Button type="button" onClick={aoTentarNovamente}>
          Tentar novamente
        </Button>
      </div>
    </main>
  );
}
