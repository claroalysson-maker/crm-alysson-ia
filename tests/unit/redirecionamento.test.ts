import { describe, expect, it } from "vitest";
import { decidirRedirecionamento } from "@/lib/redirecionamento";

describe("decidirRedirecionamento (segundo argumento: sessao valida)", () => {
  it("sem sessao valida em rota protegida vai para /login", () => {
    expect(decidirRedirecionamento("/dashboard", false)).toBe("/login");
    expect(decidirRedirecionamento("/clientes/1", false)).toBe("/login");
    expect(decidirRedirecionamento("/", false)).toBe("/login");
  });

  it("sem sessao valida em /login nao redireciona (usuario sem perfil nao entra em loop)", () => {
    expect(decidirRedirecionamento("/login", false)).toBeNull();
  });

  it("sessao valida em /login ou / vai para /dashboard", () => {
    expect(decidirRedirecionamento("/login", true)).toBe("/dashboard");
    expect(decidirRedirecionamento("/", true)).toBe("/dashboard");
  });

  it("sessao valida em rota protegida nao redireciona", () => {
    expect(decidirRedirecionamento("/dashboard", true)).toBeNull();
  });
});

describe("decidirRedirecionamento (terceiro argumento: precisa trocar a senha)", () => {
  it("quem precisa trocar a senha e levado para /definir-senha em qualquer rota", () => {
    expect(decidirRedirecionamento("/dashboard", true, true)).toBe("/definir-senha");
    expect(decidirRedirecionamento("/clientes/1", true, true)).toBe("/definir-senha");
    expect(decidirRedirecionamento("/login", true, true)).toBe("/definir-senha");
    expect(decidirRedirecionamento("/", true, true)).toBe("/definir-senha");
  });

  it("em /definir-senha quem precisa trocar segue normalmente", () => {
    expect(decidirRedirecionamento("/definir-senha", true, true)).toBeNull();
  });

  it("quem nao precisa trocar e mandado de /definir-senha para /dashboard", () => {
    expect(decidirRedirecionamento("/definir-senha", true, false)).toBe("/dashboard");
    expect(decidirRedirecionamento("/definir-senha", true)).toBe("/dashboard");
  });

  it("sem sessao /definir-senha vai para /login", () => {
    expect(decidirRedirecionamento("/definir-senha", false)).toBe("/login");
  });
});
