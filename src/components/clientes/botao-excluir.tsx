"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { removerCliente } from "@/app/(app)/clientes/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { confirmarExclusao, podeAlterarAbertura } from "@/lib/clientes/exclusao";

export function BotaoExcluir({ id, nome }: { id: string; nome: string }) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string>();
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    iniciar(async () => {
      const resultado = await confirmarExclusao(removerCliente, id);
      if (resultado.erro) setErro(resultado.erro);
      else setAberto(false);
    });
  }

  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(novo) => {
        if (!podeAlterarAbertura(novo, pendente)) return;
        setAberto(novo);
        if (novo) setErro(undefined);
      }}
    >
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Excluir ${nome}`} />}
      >
        <Trash2 aria-hidden="true" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
          <AlertDialogDescription>
            {nome} será removido permanentemente. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
          {erro}
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={confirmar} disabled={pendente}>
            {pendente ? "Excluindo..." : "Excluir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
