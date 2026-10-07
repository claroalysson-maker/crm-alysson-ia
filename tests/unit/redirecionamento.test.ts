import { describe, expect, it } from "vitest";
import { decidirRedirecionamento } from "@/lib/redirecionamento";

describe("decidirRedirecionamento", () => {
  it("sem sessao em rota protegida vai para /login", () => {
    expect(decidirRedirecionamento("/dashboard", false)).toBe("/login");
    expect(decidirRedirecionamento("/clientes/1", false)).toBe("/login");
  });

  it("sem sessao em / vai para /login", () => {
    expect(decidirRedirecionamento("/", false)).toBe("/login");
  });

  it("sem sessao em /login nao redireciona", () => {
    expect(decidirRedirecionamento("/login", false)).toBeNull();
  });

  it("com sessao em /login vai para /dashboard", () => {
    expect(decidirRedirecionamento("/login", true)).toBe("/dashboard");
  });

  it("com sessao em / vai para /dashboard", () => {
    expect(decidirRedirecionamento("/", true)).toBe("/dashboard");
  });

  it("com sessao em rota protegida nao redireciona", () => {
    expect(decidirRedirecionamento("/dashboard", true)).toBeNull();
  });
});
