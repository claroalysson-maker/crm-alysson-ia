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
