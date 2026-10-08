"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { sair } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ITENS = [
  { href: "/dashboard", rotulo: "Dashboard" },
  { href: "/clientes", rotulo: "Clientes" },
] as const;

function Navegacao({ aoNavegar }: { aoNavegar?: () => void }) {
  const caminho = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {ITENS.map(({ href, rotulo }) => {
        const ativo = caminho === href || caminho.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={aoNavegar}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              ativo && "bg-accent text-accent-foreground",
            )}
          >
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

function BotaoSair() {
  return (
    <form action={sair}>
      <Button type="submit" variant="ghost" className="w-full justify-start">
        <LogOut aria-hidden="true" />
        Sair
      </Button>
    </form>
  );
}

export function MenuLateral() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <aside className="hidden w-56 shrink-0 flex-col justify-between border-r border-border bg-card p-4 md:flex">
        <div className="flex flex-col gap-6">
          <span className="px-3 text-lg font-semibold">CRM</span>
          <Navegacao />
        </div>
        <BotaoSair />
      </aside>

      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2 md:hidden">
        <span className="text-lg font-semibold">CRM</span>
        <Sheet open={aberto} onOpenChange={setAberto}>
          <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Abrir menu" />}>
            <Menu aria-hidden="true" />
          </SheetTrigger>
          <SheetContent side="left" className="justify-between p-4">
            <div className="flex flex-col gap-6">
              <SheetTitle>CRM</SheetTitle>
              <SheetDescription className="sr-only">Navegação principal</SheetDescription>
              <Navegacao aoNavegar={() => setAberto(false)} />
            </div>
            <BotaoSair />
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
