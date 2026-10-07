"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Cliente } from "@/lib/clientes/schema";
import { FormularioCliente } from "./formulario-cliente";

type Props = {
  /** Sem cliente: cria; com cliente: edita (formulario preenchido). */
  cliente?: Cliente;
  children: ReactNode;
  rotuloAcessivel?: string;
} & Pick<ComponentProps<typeof Button>, "variant" | "size">;

export function PainelForm({ cliente, children, rotuloAcessivel, variant, size }: Props) {
  const [aberto, setAberto] = useState(false);

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger render={<Button variant={variant} size={size} aria-label={rotuloAcessivel} />}>
        {children}
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{cliente ? "Editar cliente" : "Novo cliente"}</SheetTitle>
          <SheetDescription>
            {cliente ? "Atualize os dados do cliente." : "Preencha os dados do novo cliente."}
          </SheetDescription>
        </SheetHeader>
        <FormularioCliente cliente={cliente} aoSalvar={() => setAberto(false)} />
      </SheetContent>
    </Sheet>
  );
}
