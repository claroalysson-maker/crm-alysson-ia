import { describe, expect, it } from "vitest";
import { loginSchema } from "@/lib/login-schema";

describe("loginSchema", () => {
  it("normaliza o e-mail com trim e minusculas", () => {
    const r = loginSchema.parse({ email: "  ANA@Exemplo.com ", senha: "x" });
    expect(r.email).toBe("ana@exemplo.com");
  });

  it("rejeita e-mail invalido", () => {
    expect(loginSchema.safeParse({ email: "nao-e-email", senha: "x" }).success).toBe(false);
  });

  it("rejeita senha vazia", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", senha: "" }).success).toBe(false);
  });
});
