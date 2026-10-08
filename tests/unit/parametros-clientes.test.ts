import { describe, expect, it } from "vitest";
import { lerParametrosClientes } from "@/lib/clientes/parametros";

describe("lerParametrosClientes", () => {
  it("usa padroes quando nao ha parametros", () => {
    expect(lerParametrosClientes({})).toEqual({ busca: "", status: undefined, pagina: 1 });
  });

  it("aplica trim na busca e usa o primeiro valor de um array", () => {
    expect(lerParametrosClientes({ busca: "  ana " }).busca).toBe("ana");
    expect(lerParametrosClientes({ busca: [" bia ", "carla"] }).busca).toBe("bia");
    expect(lerParametrosClientes({ busca: [] }).busca).toBe("");
  });

  it("limita a busca a 200 caracteres", () => {
    expect(lerParametrosClientes({ busca: "a".repeat(500) }).busca).toBe("a".repeat(200));
    expect(lerParametrosClientes({ busca: "b".repeat(200) }).busca).toBe("b".repeat(200));
    expect(lerParametrosClientes({ busca: `  ${"c".repeat(300)}` }).busca).toHaveLength(200);
  });

  it.each(["lead", "cliente", "perdido"])("aceita o status %s", (status) => {
    expect(lerParametrosClientes({ status }).status).toBe(status);
  });

  it.each(["", "ativo", "LEAD"])("ignora status invalido %j", (status) => {
    expect(lerParametrosClientes({ status }).status).toBeUndefined();
  });

  it("usa o primeiro status de um array", () => {
    expect(lerParametrosClientes({ status: ["lead", "x"] }).status).toBe("lead");
    expect(lerParametrosClientes({ status: ["x", "lead"] }).status).toBeUndefined();
  });

  it.each([
    ["3", 3],
    [["2", "9"], 2],
    ["0", 1],
    ["-1", 1],
    ["1.5", 1],
    ["abc", 1],
    ["", 1],
    [undefined, 1],
    ["99999999999999999999", 1],
  ])("pagina %j -> %s", (pagina, esperado) => {
    expect(lerParametrosClientes({ pagina }).pagina).toBe(esperado);
  });

  it("nunca lanca com entradas estranhas", () => {
    expect(() =>
      lerParametrosClientes({ busca: undefined, status: undefined, pagina: undefined, x: "1" }),
    ).not.toThrow();
  });
});
