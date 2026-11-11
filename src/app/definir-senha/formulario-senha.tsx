"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EstadoSenha } from "@/lib/senha-schema";
import { definirSenha } from "./actions";

export function FormularioSenha() {
  const [estado, acao, pendente] = useActionState<EstadoSenha, FormData>(definirSenha, {});

  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="senha">Nova senha</Label>
        <Input id="senha" name="senha" type="password" autoComplete="new-password" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmacao">Confirme a nova senha</Label>
        <Input
          id="confirmacao"
          name="confirmacao"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
        {estado.erro}
      </p>
      <Button type="submit" disabled={pendente}>
        {pendente ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}
