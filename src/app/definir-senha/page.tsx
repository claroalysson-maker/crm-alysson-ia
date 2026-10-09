import type { Metadata } from "next";
import { sair } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormularioSenha } from "./formulario-senha";

export const metadata: Metadata = { title: "Definir nova senha" };

export default function PaginaDefinirSenha() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Definir nova senha</CardTitle>
          <CardDescription>
            Este é o seu primeiro acesso. Escolha uma nova senha para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormularioSenha />
          <form action={sair}>
            <Button type="submit" variant="ghost" className="w-full">
              Sair
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
