import { describe, expect, it } from "vitest";
import { senhaSchema } from "@/lib/senha-schema";

describe("senhaSchema", () => {
  it("aceita senha valida com confirmacao igual", () => {
    expect(senhaSchema.safeParse({ senha: "umaSenhaBoa1", confirmacao: "umaSenhaBoa1" }).success).toBe(true);
  });

  it("rejeita senha com menos de 8 caracteres", () => {
    const r = senhaSchema.safeParse({ senha: "curta12", confirmacao: "curta12" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("A senha deve ter pelo menos 8 caracteres");
  });

  it("rejeita senha com mais de 72 caracteres (limite do bcrypt)", () => {
    const longa = "a".repeat(73);
    expect(senhaSchema.safeParse({ senha: longa, confirmacao: longa }).success).toBe(false);
  });

  it("o limite de 72 e em bytes: 40 acentuadas (80 bytes) sao rejeitadas, 36 (72 bytes) aceitas", () => {
    const acima = "é".repeat(40);
    expect(senhaSchema.safeParse({ senha: acima, confirmacao: acima }).success).toBe(false);
    const limite = "é".repeat(36);
    expect(senhaSchema.safeParse({ senha: limite, confirmacao: limite }).success).toBe(true);
  });

  it("rejeita confirmacao diferente", () => {
    const r = senhaSchema.safeParse({ senha: "umaSenhaBoa1", confirmacao: "outraSenha12" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("As senhas não conferem");
  });

  it("rejeita campos ausentes", () => {
    expect(senhaSchema.safeParse({}).success).toBe(false);
  });
});
