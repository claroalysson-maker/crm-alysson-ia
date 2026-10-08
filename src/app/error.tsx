"use client";

import { useEffect } from "react";
import { ErroGenerico } from "@/components/erro-generico";

type Props = { error: Error & { digest?: string }; retry: () => void };

export default function Erro({ error, retry }: Props) {
  useEffect(() => {
    // So o identificador (digest) liga ao log do servidor; mensagem/stack nao sao registradas.
    console.error("Erro inesperado na tela:", error.digest ?? "sem identificador");
  }, [error]);

  return <ErroGenerico aoTentarNovamente={retry} />;
}
