"use client";

import { useEffect } from "react";
import { ErroGenerico } from "@/components/erro-generico";
import "./globals.css";

type Props = { error: Error & { digest?: string }; retry: () => void };

/** Substitui o layout raiz quando ele proprio falha: precisa de <html>/<body> e dos estilos. */
export default function ErroGlobal({ error, retry }: Props) {
  useEffect(() => {
    console.error("Erro inesperado no layout raiz:", error.digest ?? "sem identificador");
  }, [error]);

  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ErroGenerico aoTentarNovamente={retry} />
      </body>
    </html>
  );
}
