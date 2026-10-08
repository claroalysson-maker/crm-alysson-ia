"use client";

import { useActionState, type ReactNode } from "react";
import { salvarCliente } from "@/app/(app)/clientes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EstadoForm } from "@/lib/clientes/formulario";
import { ROTULO_STATUS } from "@/lib/clientes/formato";
import { STATUS, type Cliente } from "@/lib/clientes/schema";

type Props = { cliente?: Cliente; aoSalvar: () => void };

function Campo({
  id,
  rotulo,
  erro,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
      {erro && (
        <p id={`${id}-erro`} role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}

export function FormularioCliente({ cliente, aoSalvar }: Props) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(
    async (anterior, form) => {
      const resultado = await salvarCliente(anterior, form);
      if (resultado.ok) aoSalvar();
      return resultado;
    },
    {},
  );
  const erros = estado.erros ?? {};
  const valor = (campo: keyof Cliente) =>
    estado.valores?.[campo] ?? String(cliente?.[campo] ?? "");
  const propsErro = (campo: string) => ({
    "aria-invalid": erros[campo] ? true : undefined,
    "aria-describedby": erros[campo] ? `${campo}-erro` : undefined,
  });

  return (
    <form action={acao} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4" noValidate>
      {cliente && <input type="hidden" name="id" value={cliente.id} />}
      <Campo id="nome" rotulo="Nome" erro={erros.nome}>
        <Input id="nome" name="nome" defaultValue={valor("nome")} required {...propsErro("nome")} />
      </Campo>
      <Campo id="email" rotulo="E-mail" erro={erros.email}>
        <Input id="email" name="email" type="email" defaultValue={valor("email")} {...propsErro("email")} />
      </Campo>
      <Campo id="telefone" rotulo="Telefone" erro={erros.telefone}>
        <Input id="telefone" name="telefone" type="tel" defaultValue={valor("telefone")} {...propsErro("telefone")} />
      </Campo>
      <Campo id="empresa_contato" rotulo="Empresa" erro={erros.empresa_contato}>
        <Input
          id="empresa_contato"
          name="empresa_contato"
          defaultValue={valor("empresa_contato")}
          {...propsErro("empresa_contato")}
        />
      </Campo>
      <Campo id="status" rotulo="Status" erro={erros.status}>
        <select
          id="status"
          name="status"
          defaultValue={estado.valores?.status ?? cliente?.status ?? "lead"}
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          {...propsErro("status")}
        >
          {STATUS.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS[s]}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id="valor_estimado" rotulo="Valor estimado (R$)" erro={erros.valor_estimado}>
        <Input
          id="valor_estimado"
          name="valor_estimado"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={valor("valor_estimado")}
          {...propsErro("valor_estimado")}
        />
      </Campo>
      <Campo id="notas" rotulo="Notas" erro={erros.notas}>
        <Textarea id="notas" name="notas" rows={4} defaultValue={valor("notas")} {...propsErro("notas")} />
      </Campo>
      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
        {erros._form}
      </p>
      <Button type="submit" disabled={pendente}>
        {pendente ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
