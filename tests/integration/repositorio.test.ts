import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clienteSchema, type ClienteInput } from "@/lib/clientes/schema";
import {
  TAMANHO_PAGINA,
  atualizarCliente,
  criarCliente,
  excluirCliente,
  listarClientes,
} from "@/lib/clientes/repositorio";
import {
  clienteServico,
  criarEmpresaComUsuario,
  limparEmpresaComUsuario,
  type EmpresaComUsuario,
} from "./helpers";

const sufixo = randomUUID().slice(0, 8);
const senha = `Senha-${randomUUID()}`;

function novo(nome: string, extra: Partial<ClienteInput> = {}): ClienteInput {
  return clienteSchema.parse({ nome, status: "lead", ...extra });
}

async function nomesDaBusca(
  db: EmpresaComUsuario["clienteSupabase"],
  busca: string,
) {
  const r = await listarClientes(db, { busca });
  return r.itens.map((c) => c.nome).sort();
}

describe("repositorio de clientes", () => {
  let a: EmpresaComUsuario;
  let b: EmpresaComUsuario;

  beforeAll(async () => {
    a = await criarEmpresaComUsuario(
      "Repo A",
      `repo-a-${sufixo}@teste.invalid`,
      senha,
    );
    b = await criarEmpresaComUsuario(
      "Repo B",
      `repo-b-${sufixo}@teste.invalid`,
      senha,
    );
  });

  afterAll(async () => {
    const resultados = await Promise.allSettled(
      [a, b].filter(Boolean).map((e) => limparEmpresaComUsuario(e)),
    );
    const falhas = resultados.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    if (falhas.length > 0) {
      throw new Error(
        falhas.map((f) => (f.reason as Error).message).join(" | "),
      );
    }
    // Garante que nao sobrou nenhuma linha dos clientes de teste.
    const { count, error } = await clienteServico()
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .in(
        "empresa_id",
        [a?.empresaId, b?.empresaId].filter(Boolean) as string[],
      );
    if (error) throw new Error(`Falha ao conferir limpeza: ${error.message}`);
    expect(count).toBe(0);
  });

  describe("criar, atualizar e excluir", () => {
    it("cria cliente na empresa do usuario sem enviar empresa_id", async () => {
      const criado = await criarCliente(
        a.clienteSupabase,
        novo("Crud Ana", { valor_estimado: 10.5 }),
      );
      expect(criado.empresa_id).toBe(a.empresaId);
      expect(criado.nome).toBe("Crud Ana");
      expect(criado.valor_estimado).toBe(10.5);
      expect(criado.status).toBe("lead");
      expect(criado.email).toBeNull();
      await excluirCliente(a.clienteSupabase, criado.id);
    });

    it("atualiza os campos e devolve o registro atualizado", async () => {
      const criado = await criarCliente(a.clienteSupabase, novo("Crud Bia"));
      const atualizado = await atualizarCliente(
        a.clienteSupabase,
        criado.id,
        novo("Crud Bia Souza", {
          status: "cliente",
          email: "bia@x.com",
          valor_estimado: 99.9,
        }),
      );
      expect(atualizado.id).toBe(criado.id);
      expect(atualizado.nome).toBe("Crud Bia Souza");
      expect(atualizado.status).toBe("cliente");
      expect(atualizado.email).toBe("bia@x.com");
      expect(atualizado.valor_estimado).toBe(99.9);
      expect(atualizado.empresa_id).toBe(a.empresaId);
      await excluirCliente(a.clienteSupabase, criado.id);
    });

    it("excluir remove o registro", async () => {
      const criado = await criarCliente(a.clienteSupabase, novo("Crud Caio"));
      await excluirCliente(a.clienteSupabase, criado.id);
      const r = await listarClientes(a.clienteSupabase, { busca: "Crud Caio" });
      expect(r.itens).toHaveLength(0);
    });

    it("atualizar cliente de outra empresa falha com mensagem curta (RLS)", async () => {
      const deB = await criarCliente(b.clienteSupabase, novo("Crud Do B"));
      await expect(
        atualizarCliente(a.clienteSupabase, deB.id, novo("Invasao")),
      ).rejects.toThrow(/cliente/i);
      const r = await listarClientes(b.clienteSupabase, { busca: "Crud Do B" });
      expect(r.itens.map((c) => c.nome)).toEqual(["Crud Do B"]);
      await excluirCliente(b.clienteSupabase, deB.id);
    });

    it("excluir id inexistente nao lanca erro", async () => {
      await expect(
        excluirCliente(a.clienteSupabase, randomUUID()),
      ).resolves.toBeUndefined();
    });
  });

  describe("paginacao", () => {
    beforeAll(async () => {
      const linhas = Array.from({ length: 25 }, (_, i) => ({
        empresa_id: b.empresaId,
        nome: `Pag ${String(i).padStart(2, "0")}`,
      }));
      const { error } = await clienteServico().from("clientes").insert(linhas);
      if (error) throw new Error(`Falha ao semear paginacao: ${error.message}`);
    });

    it("TAMANHO_PAGINA e 20", () => {
      expect(TAMANHO_PAGINA).toBe(20);
    });

    it("pagina 1 devolve 20 itens, total 25 e 2 paginas", async () => {
      const r = await listarClientes(b.clienteSupabase, {});
      expect(r.itens).toHaveLength(20);
      expect(r.total).toBe(25);
      expect(r.totalPaginas).toBe(2);
      expect(r.pagina).toBe(1);
    });

    it("pagina 2 devolve 5 itens, sem repetir os da pagina 1", async () => {
      const p1 = await listarClientes(b.clienteSupabase, { pagina: 1 });
      const p2 = await listarClientes(b.clienteSupabase, { pagina: 2 });
      expect(p2.itens).toHaveLength(5);
      expect(p2.pagina).toBe(2);
      const ids = new Set([...p1.itens, ...p2.itens].map((c) => c.id));
      expect(ids.size).toBe(25);
    });

    it("ordena por criado_em decrescente", async () => {
      const r = await listarClientes(b.clienteSupabase, {});
      const datas = r.itens.map((c) => c.criado_em);
      expect([...datas].sort().reverse()).toEqual(datas);
    });

    it("pagina alem da ultima devolve a ultima pagina", async () => {
      const r = await listarClientes(b.clienteSupabase, { pagina: 999 });
      expect(r.pagina).toBe(2);
      expect(r.itens).toHaveLength(5);
    });

    it.each([NaN, 0, -3, 1.5, Infinity])(
      "pagina %s devolve a primeira",
      async (pagina) => {
        const r = await listarClientes(b.clienteSupabase, { pagina });
        expect(r.pagina).toBe(1);
        expect(r.itens).toHaveLength(20);
      },
    );

    it("sem resultados: totalPaginas e pelo menos 1 e pagina 1", async () => {
      const r = await listarClientes(b.clienteSupabase, {
        busca: `nada-${sufixo}`,
        pagina: 5,
      });
      expect(r).toEqual({ itens: [], total: 0, pagina: 1, totalPaginas: 1 });
    });
  });

  describe("filtros", () => {
    const ids: string[] = [];

    beforeAll(async () => {
      const dados = [
        novo("Filtro Maria Silva", {
          email: "maria@alfa.com",
          status: "cliente",
        }),
        novo("Filtro João Pereira", { email: "joao@beta.com", status: "lead" }),
        novo("Filtro Zeca", { email: "contato@GAMMA.com", status: "perdido" }),
      ];
      for (const d of dados)
        ids.push((await criarCliente(a.clienteSupabase, d)).id);
    });

    it("busca por parte do nome, sem diferenciar caixa", async () => {
      expect(await nomesDaBusca(a.clienteSupabase, "maria sil")).toEqual([
        "Filtro Maria Silva",
      ]);
      expect(await nomesDaBusca(a.clienteSupabase, "PEREIRA")).toEqual([
        "Filtro João Pereira",
      ]);
    });

    it("busca por parte do e-mail, sem diferenciar caixa", async () => {
      expect(await nomesDaBusca(a.clienteSupabase, "@ALFA")).toEqual([
        "Filtro Maria Silva",
      ]);
      expect(await nomesDaBusca(a.clienteSupabase, "gamma")).toEqual([
        "Filtro Zeca",
      ]);
    });

    it("busca so com espacos equivale a sem busca", async () => {
      const r = await listarClientes(a.clienteSupabase, { busca: "   " });
      expect(r.total).toBeGreaterThanOrEqual(3);
    });

    it("filtra por status", async () => {
      const r = await listarClientes(a.clienteSupabase, { status: "perdido" });
      expect(r.itens.every((c) => c.status === "perdido")).toBe(true);
      expect(r.itens.map((c) => c.nome)).toContain("Filtro Zeca");
    });

    it("combina busca e status", async () => {
      const r = await listarClientes(a.clienteSupabase, {
        busca: "filtro",
        status: "lead",
      });
      expect(r.itens.map((c) => c.nome)).toEqual(["Filtro João Pereira"]);
    });

    it("status invalido e ignorado, sem erro", async () => {
      const todos = await listarClientes(a.clienteSupabase, {});
      const r = await listarClientes(a.clienteSupabase, {
        status: "invalido" as unknown as "lead",
      });
      expect(r.total).toBe(todos.total);
    });

    it("so enxerga clientes da propria empresa", async () => {
      expect(await nomesDaBusca(b.clienteSupabase, "Filtro")).toEqual([]);
    });

    afterAll(async () => {
      for (const id of ids) await excluirCliente(a.clienteSupabase, id);
    });
  });

  describe("caracteres especiais na busca sao texto literal", () => {
    const NOMES = [
      "Esp a%b",
      "Esp a_b",
      "Esp a,b",
      "Esp a(b)",
      'Esp a"b',
      "Esp axb",
      String.raw`Esp a\b`,
      "Esp a*b",
    ];
    const ids: string[] = [];

    beforeAll(async () => {
      for (const n of NOMES)
        ids.push((await criarCliente(a.clienteSupabase, novo(n))).id);
    });

    afterAll(async () => {
      for (const id of ids) await excluirCliente(a.clienteSupabase, id);
    });

    it("% e literal", async () => {
      expect(await nomesDaBusca(a.clienteSupabase, "a%b")).toEqual(["Esp a%b"]);
    });

    it("_ e literal", async () => {
      expect(await nomesDaBusca(a.clienteSupabase, "a_b")).toEqual(["Esp a_b"]);
    });

    it("virgula e literal e nao quebra o or()", async () => {
      expect(await nomesDaBusca(a.clienteSupabase, "a,b")).toEqual(["Esp a,b"]);
    });

    it("parenteses sao literais e nao quebram o or()", async () => {
      expect(await nomesDaBusca(a.clienteSupabase, "a(b)")).toEqual([
        "Esp a(b)",
      ]);
      expect(await nomesDaBusca(a.clienteSupabase, ")")).toEqual(["Esp a(b)"]);
      expect(await nomesDaBusca(a.clienteSupabase, "(")).toEqual(["Esp a(b)"]);
    });

    it("aspas sao literais e nao quebram o or()", async () => {
      expect(await nomesDaBusca(a.clienteSupabase, 'a"b')).toEqual(['Esp a"b']);
      expect(await nomesDaBusca(a.clienteSupabase, '"')).toEqual(['Esp a"b']);
    });

    it("barra invertida e literal", async () => {
      expect(await nomesDaBusca(a.clienteSupabase, String.raw`a\b`)).toEqual([
        String.raw`Esp a\b`,
      ]);
    });

    it("% sozinho so casa nomes com %, nao todos", async () => {
      expect(await nomesDaBusca(a.clienteSupabase, "%")).toEqual(["Esp a%b"]);
    });

    it("_ sozinho so casa nomes com _, nao todos", async () => {
      expect(await nomesDaBusca(a.clienteSupabase, "_")).toEqual(["Esp a_b"]);
    });

    it("termo com todos os especiais juntos nao lanca erro e nao casa nada", async () => {
      expect(
        await nomesDaBusca(a.clienteSupabase, String.raw`%_,()"\*`),
      ).toEqual([]);
    });

    it("asterisco nao vira curinga livre: acha o literal e nao casa o que nao existe", async () => {
      expect(await nomesDaBusca(a.clienteSupabase, "a*b")).toContain("Esp a*b");
      expect(await nomesDaBusca(a.clienteSupabase, "a*bb")).toEqual([]);
      // Limitacao documentada: o PostgREST reescreve * em %, entao * vira "um caractere qualquer".
      expect(await nomesDaBusca(a.clienteSupabase, "a*b")).toHaveLength(8);
    });

    it("a mesma busca por termo especial acha o e-mail", async () => {
      const c = await criarCliente(
        a.clienteSupabase,
        novo("Esp Email", { email: "x_y@z.com" }),
      );
      try {
        expect(await nomesDaBusca(a.clienteSupabase, "x_y@")).toEqual([
          "Esp Email",
        ]);
        expect(await nomesDaBusca(a.clienteSupabase, "xzy@")).toEqual([]);
      } finally {
        await excluirCliente(a.clienteSupabase, c.id);
      }
    });
  });
});
