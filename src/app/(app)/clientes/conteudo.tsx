import { EstadoVazio, ErroNaLista, SemResultados } from "@/components/clientes/estados";
import { FiltrosClientes } from "@/components/clientes/filtros";
import { Paginacao } from "@/components/clientes/paginacao";
import { PainelForm } from "@/components/clientes/painel-form";
import { TabelaClientes } from "@/components/clientes/tabela";
import {
  lerParametrosClientes,
  type ParametrosClientes,
} from "@/lib/clientes/parametros";
import { listarClientes, type ListaClientes } from "@/lib/clientes/repositorio";
import { createServerClient } from "@/lib/supabase/server";

type ParametrosBrutos = Parameters<typeof lerParametrosClientes>[0];

async function carregar(
  params: ParametrosClientes,
): Promise<ListaClientes | null> {
  try {
    return await listarClientes(await createServerClient(), params);
  } catch (erro) {
    console.error("Falha ao carregar a página de clientes:", (erro as Error).message);
    return null;
  }
}

function Cabecalho({ novo }: { novo: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h1 className="text-2xl font-semibold">Clientes</h1>
      {novo && <PainelForm>Novo cliente</PainelForm>}
    </div>
  );
}

export async function ConteudoClientes({
  searchParams,
}: {
  searchParams: Promise<ParametrosBrutos>;
}) {
  const params = lerParametrosClientes(await searchParams);
  const lista = await carregar(params);

  if (!lista) {
    return (
      <>
        <Cabecalho novo={false} />
        <ErroNaLista />
      </>
    );
  }

  const filtrando = params.busca !== "" || params.status !== undefined;
  if (lista.total === 0 && !filtrando) {
    return (
      <>
        <Cabecalho novo={false} />
        <EstadoVazio />
      </>
    );
  }

  return (
    <>
      <Cabecalho novo />
      <FiltrosClientes busca={params.busca} status={params.status} />
      {lista.total === 0 ? (
        <SemResultados />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <TabelaClientes clientes={lista.itens} />
          </div>
          <Paginacao
            pagina={lista.pagina}
            totalPaginas={lista.totalPaginas}
            busca={params.busca}
            status={params.status}
          />
        </>
      )}
    </>
  );
}
