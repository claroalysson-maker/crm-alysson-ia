import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/login/formulario-login", () => ({ FormularioLogin: () => null }));
vi.mock("@/app/(app)/dashboard/conteudo", () => ({ ConteudoDashboard: () => null }));
vi.mock("@/app/(app)/clientes/conteudo", () => ({ ConteudoClientes: () => null }));
vi.mock("next/font/google", () => ({ Inter: () => ({ variable: "--font-inter" }) }));

import { metadata as raiz } from "@/app/layout";
import { metadata as clientes } from "@/app/(app)/clientes/page";
import { metadata as dashboard } from "@/app/(app)/dashboard/page";
import { metadata as login } from "@/app/login/page";

describe("titulos das paginas", () => {
  it("raiz define titulo padrao e modelo em portugues", () => {
    expect(raiz.title).toEqual({ default: "CRM", template: "%s | CRM" });
  });

  it.each([
    ["/login", login, "Entrar"],
    ["/dashboard", dashboard, "Dashboard"],
    ["/clientes", clientes, "Clientes"],
  ])("%s tem titulo proprio estatico", (_rota, metadados, titulo) => {
    expect(metadados.title).toBe(titulo);
  });
});
