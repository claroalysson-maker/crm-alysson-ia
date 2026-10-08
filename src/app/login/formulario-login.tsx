"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EstadoLogin } from "@/lib/login-schema";
import { entrar } from "./actions";

export function FormularioLogin({ erroInicial }: { erroInicial?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, {
    erro: erroInicial,
  });

  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={estado.email}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="senha">Senha</Label>
        <Input id="senha" name="senha" type="password" autoComplete="current-password" required />
      </div>
      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
        {estado.erro}
      </p>
      <Button type="submit" disabled={pendente}>
        {pendente ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
