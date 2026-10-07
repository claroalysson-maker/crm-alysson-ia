import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: () => {}, // efeitos nao rodam no SSR estatico; o log e verificado a parte
}));
vi.mock("@/app/globals.css", () => ({}));

import Erro from "@/app/error";
import ErroGlobal from "@/app/global-error";

const erro = Object.assign(new Error("detalhe tecnico secreto"), { digest: "abc" });

describe("paginas de erro", () => {
  it.each([
    ["error.tsx", Erro],
    ["global-error.tsx", ErroGlobal],
  ])("%s mostra mensagem amigavel, botao de nova tentativa e nenhum detalhe tecnico", (_n, Pagina) => {
    const html = renderToStaticMarkup(createElement(Pagina, { error: erro, retry: () => {} }));
    expect(html).toContain("Algo deu errado");
    expect(html).toContain("Tentar novamente");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("secreto");
    expect(html).not.toContain("abc");
  });

  it("global-error define html e body proprios", () => {
    const html = renderToStaticMarkup(createElement(ErroGlobal, { error: erro, retry: () => {} }));
    expect(html).toMatch(/^<html lang="pt-BR"/);
    expect(html).toContain("<body");
  });
});
