import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { erroDaUrl } from "@/lib/login";
import { FormularioLogin } from "./formulario-login";

async function FormularioComErroDaUrl({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string | string[] }>;
}) {
  const { erro } = await searchParams;
  return <FormularioLogin erroInicial={erroDaUrl(erro)} />;
}

export default function PaginaLogin({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Entrar</CardTitle>
          <CardDescription>Acesse o CRM da sua empresa</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<FormularioLogin />}>
            <FormularioComErroDaUrl searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
