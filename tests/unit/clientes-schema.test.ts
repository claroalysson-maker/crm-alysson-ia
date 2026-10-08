import { describe, expect, it } from "vitest";
import { clienteSchema } from "@/lib/clientes/schema";

const base = { nome: "Ana", status: "lead" as const };

describe("clienteSchema", () => {
  it("aceita o minimo: nome e status", () => {
    const r = clienteSchema.parse(base);
    expect(r).toEqual({
      nome: "Ana",
      email: null,
      telefone: null,
      empresa_contato: null,
      status: "lead",
      valor_estimado: 0,
      notas: null,
    });
  });

  it("rejeita nome vazio ou so com espacos", () => {
    expect(clienteSchema.safeParse({ ...base, nome: "" }).success).toBe(false);
    expect(clienteSchema.safeParse({ ...base, nome: "   " }).success).toBe(
      false,
    );
  });

  it("aplica trim no nome", () => {
    expect(clienteSchema.parse({ ...base, nome: "  Ana  " }).nome).toBe("Ana");
  });

  it("rejeita status invalido", () => {
    expect(clienteSchema.safeParse({ ...base, status: "outro" }).success).toBe(
      false,
    );
  });

  it("e-mail vazio vira null e e-mail invalido e rejeitado", () => {
    expect(clienteSchema.parse({ ...base, email: "" }).email).toBeNull();
    expect(
      clienteSchema.safeParse({ ...base, email: "nao-e-email" }).success,
    ).toBe(false);
    expect(clienteSchema.parse({ ...base, email: "a@b.com" }).email).toBe(
      "a@b.com",
    );
  });

  it("textos opcionais vazios viram null", () => {
    const r = clienteSchema.parse({
      ...base,
      telefone: " ",
      empresa_contato: "",
      notas: "",
    });
    expect(r.telefone).toBeNull();
    expect(r.empresa_contato).toBeNull();
    expect(r.notas).toBeNull();
  });

  describe("limites de tamanho", () => {
    it("nome ate 200", () => {
      expect(
        clienteSchema.safeParse({ ...base, nome: "a".repeat(200) }).success,
      ).toBe(true);
      expect(
        clienteSchema.safeParse({ ...base, nome: "a".repeat(201) }).success,
      ).toBe(false);
    });
    it("email ate 254", () => {
      const longo = `${"a".repeat(245)}@b.com`;
      expect(longo.length).toBe(251);
      expect(clienteSchema.safeParse({ ...base, email: longo }).success).toBe(
        true,
      );
      expect(
        clienteSchema.safeParse({ ...base, email: `${"a".repeat(250)}@b.com` })
          .success,
      ).toBe(false);
    });
    it("telefone ate 40", () => {
      expect(
        clienteSchema.safeParse({ ...base, telefone: "1".repeat(40) }).success,
      ).toBe(true);
      expect(
        clienteSchema.safeParse({ ...base, telefone: "1".repeat(41) }).success,
      ).toBe(false);
    });
    it("empresa_contato ate 200", () => {
      expect(
        clienteSchema.safeParse({ ...base, empresa_contato: "a".repeat(200) })
          .success,
      ).toBe(true);
      expect(
        clienteSchema.safeParse({ ...base, empresa_contato: "a".repeat(201) })
          .success,
      ).toBe(false);
    });
    it("notas ate 5000", () => {
      expect(
        clienteSchema.safeParse({ ...base, notas: "a".repeat(5000) }).success,
      ).toBe(true);
      expect(
        clienteSchema.safeParse({ ...base, notas: "a".repeat(5001) }).success,
      ).toBe(false);
    });
  });

  it("nao deixa passar colunas de controle", () => {
    const r = clienteSchema.parse({
      ...base,
      id: "x",
      empresa_id: "y",
      criado_em: "z",
      atualizado_em: "w",
    });
    expect(Object.keys(r)).not.toEqual(expect.arrayContaining(["id"]));
    expect(r).not.toHaveProperty("empresa_id");
    expect(r).not.toHaveProperty("criado_em");
    expect(r).not.toHaveProperty("atualizado_em");
  });

  describe("valor_estimado", () => {
    const valor = (v: unknown) =>
      clienteSchema.safeParse({ ...base, valor_estimado: v });

    it("vazio, so espacos ou ausente vira 0", () => {
      expect(valor("").data?.valor_estimado).toBe(0);
      expect(valor("  ").data?.valor_estimado).toBe(0);
      expect(valor(undefined).data?.valor_estimado).toBe(0);
    });
    it("aceita 10.5 como string e como numero", () => {
      expect(valor("10.5").data?.valor_estimado).toBe(10.5);
      expect(valor(10.5).data?.valor_estimado).toBe(10.5);
    });
    it("aceita 0 e valores inteiros", () => {
      expect(valor(0).data?.valor_estimado).toBe(0);
      expect(valor("1500").data?.valor_estimado).toBe(1500);
    });
    it("rejeita negativos", () => {
      expect(valor(-5).success).toBe(false);
      expect(valor("-5").success).toBe(false);
    });
    it("rejeita mais de 2 casas decimais", () => {
      expect(valor(10.999).success).toBe(false);
      expect(valor("10.999").success).toBe(false);
      expect(valor("10.005").success).toBe(false);
    });
    it("rejeita texto, NaN e Infinity", () => {
      expect(valor("abc").success).toBe(false);
      expect(valor("10,5").success).toBe(false);
      expect(valor(NaN).success).toBe(false);
      expect(valor(Infinity).success).toBe(false);
      expect(valor("Infinity").success).toBe(false);
      expect(valor("NaN").success).toBe(false);
    });
    it("rejeita acima do limite de numeric(12,2)", () => {
      expect(valor(9999999999.99).success).toBe(true);
      expect(valor(10000000000).success).toBe(false);
    });
    it("rejeita formatos que Number() aceitaria", () => {
      for (const v of [
        "0x10",
        "0b11",
        "0o7",
        "1e3",
        "-0",
        "+5",
        ".5",
        "5.",
        "1_000",
      ]) {
        expect(valor(v).success, v).toBe(false);
      }
    });
    it("rejeita -0 numerico", () => {
      expect(valor(-0).success).toBe(false);
    });
    it("aceita decimais simples, com trim", () => {
      expect(valor("12").data?.valor_estimado).toBe(12);
      expect(valor("12.5").data?.valor_estimado).toBe(12.5);
      expect(valor(" 12 ").data?.valor_estimado).toBe(12);
      expect(valor("0.01").data?.valor_estimado).toBe(0.01);
    });
    it("rejeita casas decimais alem da segunda mesmo minusculas", () => {
      expect(valor(10.00000001).success).toBe(false);
      expect(valor("10.00000001").success).toBe(false);
      expect(valor(0.001).success).toBe(false);
    });
    it("rejeita tipos inesperados", () => {
      expect(valor(null).success).toBe(false);
      expect(valor({}).success).toBe(false);
    });
  });
});
