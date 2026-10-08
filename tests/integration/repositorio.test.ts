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

  describe("ordenacao deterministica", () => {
    const MINUTO = 60_000;
    const base = Date.now() - 10 * MINUTO;
    const ids: string[] = [];

    async function semear(
      linhas: { nome: string; criado_em: string }[],
    ): Promise<string[]> {
      const { data, error } = await clienteServico()
        .from("clientes")
        .insert(linhas.map((l) => ({ ...l, empresa_id: a.empresaId })))
        .select("id");
      if (error) throw new Error(`Falha ao semear ordenacao: ${error.message}`);
      const novos = data.map((d) => d.id as string);
      ids.push(...novos);
      return novos;
    }

    afterAll(async () => {
      const { error } = await clienteServico()
        .from("clientes")
        .delete()
        .in("id", ids);
      if (error) throw new Error(`Falha ao limpar ordenacao: ${error.message}`);
    });

    it("criado_em distintos: o mais novo vem primeiro", async () => {
      // Inseridos fora de ordem de proposito.
      await semear([
        {
          nome: "OrdDist meio",
          criado_em: new Date(base + 5 * MINUTO).toISOString(),
        },
        {
          nome: "OrdDist novo",
          criado_em: new Date(base + 9 * MINUTO).toISOString(),
        },
        {
          nome: "OrdDist velho",
          criado_em: new Date(base + 1 * MINUTO).toISOString(),
        },
      ]);
      const r = await listarClientes(a.clienteSupabase, { busca: "OrdDist" });
      expect(r.itens.map((c) => c.nome)).toEqual([
        "OrdDist novo",
        "OrdDist meio",
        "OrdDist velho",
      ]);
    });

    it("criado_em igual: desempata por id decrescente, sem repetir nem perder linhas entre paginas", async () => {
      const mesmoInstante = new Date(base + 2 * MINUTO).toISOString();
      const criados = await semear(
        Array.from({ length: 25 }, (_, i) => ({
          nome: `OrdTie ${String(i).padStart(2, "0")}`,
          criado_em: mesmoInstante,
        })),
      );
      const p1 = await listarClientes(a.clienteSupabase, {
        busca: "OrdTie",
        pagina: 1,
      });
      const p2 = await listarClientes(a.clienteSupabase, {
        busca: "OrdTie",
        pagina: 2,
      });
      expect(p1.itens).toHaveLength(20);
      expect(p2.itens).toHaveLength(5);
      const vistos = [...p1.itens, ...p2.itens].map((c) => c.id);
      expect(vistos).toEqual([...criados].sort().reverse());
    });
  });

  describe("termos hostis na busca", () => {
    const ids: string[] = [];
    let hostis: string[];

    beforeAll(async () => {
      hostis = [
        'zzz",nome.ilike."%',
        `x,empresa_id.eq.${b.empresaId}`,
        "a),(status.eq.lead",
      ];
      for (const h of hostis) {
        ids.push((await criarCliente(a.clienteSupabase, novo(`Hos ${h}`))).id);
      }
      ids.push((await criarCliente(a.clienteSupabase, novo("Hos neutro"))).id);
    });

    afterAll(async () => {
      for (const id of ids) await excluirCliente(a.clienteSupabase, id);
    });

    it.each([0, 1, 2])(
      "termo hostil %s devolve apenas o cliente com esse texto literal",
      async (i) => {
        const nomes = await nomesDaBusca(a.clienteSupabase, hostis[i]);
        expect(nomes).toEqual([`Hos ${hostis[i]}`]);
      },
    );

    it("o termo com uuid da outra empresa nao traz linhas dela", async () => {
      const r = await listarClientes(a.clienteSupabase, { busca: hostis[1] });
      expect(r.itens.every((c) => c.empresa_id === a.empresaId)).toBe(true);
    });
  });

  describe("asterisco sozinho", () => {
    it("casa todos os nomes nao vazios da propria empresa e nada de outra", async () => {
      const c = await criarCliente(a.clienteSupabase, novo("Star unico"));
      try {
        const deA = await listarClientes(a.clienteSupabase, { busca: "*" });
        const todosA = await listarClientes(a.clienteSupabase, {});
        expect(deA.total).toBe(todosA.total);
        expect(deA.itens.every((x) => x.empresa_id === a.empresaId)).toBe(true);
        const deB = await listarClientes(b.clienteSupabase, { busca: "*" });
        expect(deB.itens.map((x) => x.nome)).not.toContain("Star unico");
        expect(deB.itens.every((x) => x.empresa_id === b.empresaId)).toBe(true);
      } finally {
        await excluirCliente(a.clienteSupabase, c.id);
      }
    });
  });

  describe("payload de criar/atualizar", () => {
    it("nao repassa chaves extras (empresa_id, id, criado_em)", async () => {
      const idForjado = randomUUID();
      const hostil = {
        ...novo("Payload ok"),
        empresa_id: b.empresaId,
        id: idForjado,
        criado_em: "2000-01-01T00:00:00Z",
      } as ClienteInput;
      const criado = await criarCliente(a.clienteSupabase, hostil);
      try {
        expect(criado.empresa_id).toBe(a.empresaId);
        expect(criado.id).not.toBe(idForjado);
        expect(new Date(criado.criado_em).getFullYear()).toBeGreaterThan(2000);
        const atualizado = await atualizarCliente(
          a.clienteSupabase,
          criado.id,
          {
            ...hostil,
            nome: "Payload editado",
          } as ClienteInput,
        );
        expect(atualizado.id).toBe(criado.id);
        expect(atualizado.empresa_id).toBe(a.empresaId);
        expect(new Date(atualizado.criado_em).getFullYear()).toBeGreaterThan(
          2000,
        );
      } finally {
        await excluirCliente(a.clienteSupabase, criado.id);
      }
    });
  });
});
