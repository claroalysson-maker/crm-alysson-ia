import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROTULO_STATUS, formatarMoeda } from "@/lib/clientes/formato";
import type { Cliente, Status } from "@/lib/clientes/schema";
import { BotaoExcluir } from "./botao-excluir";
import { PainelForm } from "./painel-form";

const VARIANTE_STATUS: Record<Status, "default" | "secondary" | "destructive"> = {
  lead: "secondary",
  cliente: "default",
  perdido: "destructive",
};

export function TabelaClientes({ clientes }: { clientes: Cliente[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Valor estimado</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clientes.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">{c.nome}</TableCell>
            <TableCell>{c.email ?? "—"}</TableCell>
            <TableCell>{c.telefone ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={VARIANTE_STATUS[c.status]}>{ROTULO_STATUS[c.status]}</Badge>
            </TableCell>
            <TableCell className="text-right">{formatarMoeda(c.valor_estimado)}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <PainelForm
                  cliente={c}
                  variant="ghost"
                  size="icon-sm"
                  rotuloAcessivel={`Editar ${c.nome}`}
                >
                  <Pencil aria-hidden="true" />
                </PainelForm>
                <BotaoExcluir id={c.id} nome={c.nome} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
