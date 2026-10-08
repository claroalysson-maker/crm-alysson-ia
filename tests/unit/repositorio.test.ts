import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expressaoBusca } from "@/lib/clientes/busca";
import {
  ErroClientes,
  TAMANHO_PAGINA,
  atualizarCliente,
  criarCliente,
  excluirCliente,
  listarClientes,
} from "@/lib/clientes/repositorio";
import type { Cliente, ClienteInput } from "@/lib/clientes/schema";

type Chamada = [string, unknown[]];
type Resultado = { data?: unknown; error?: { code?: string; message: string } | null; count?: number | null };

/** Construtor de consultas falso: registra a cadeia de chamadas e resolve (await) para `resultado`. */
function consulta(resultado: Resultado) {
  const chamadas: Chamada[] = [];
  const q: unknown = new Proxy(
    {},
    {
      get: (_alvo, nome: string) => {
        if (nome === "then") {
          return (ok: (v: Resultado) => unknown, falha: (e: unknown) => unknown) =>
            Promise.resolve(resultado).then(ok, falha);
        }
        return (...args: unknown[]) => {
          chamadas.push([nome, args]);
          return q;
        };
      },
    },
  );
  return { q, chamadas };
}

function dbCom(...resultados: Resultado[]) {
  const consultas = resultados.map(consulta);
  const from = vi.fn();
  consultas.forEach((c) => from.mockReturnValueOnce(c.q));
  return { db: { from } as unknown as SupabaseClient, from, consultas };
}

const chamou = (chamadas: Chamada[], nome: string) => chamadas.filter(([n]) => n === nome);

const INPUT: ClienteInput = {
  nome: "Ana",
  email: "ana@x.com",
  telefone: null,
  empresa_contato: null,
  status: "lead",
  valor_estimado: 10,
  notas: null,
};

const CLIENTE = { id: "c1", empresa_id: "e1", ...INPUT } as unknown as Cliente;

describe("repositorio de clientes (db injetado)", () => {
  beforeEach(() => void vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  describe("listarClientes", () => {
    it("sem resultados devolve lista vazia na pagina 1 e nao faz a segunda consulta", async () => {
      const { db, from } = dbCom({ count: 0, error: null });
      const lista = await listarClientes(db, { pagina: 5 });
      expect(lista).toEqual({ itens: [], total: 0, pagina: 1, totalPaginas: 1 });
      expect(from).toHaveBeenCalledTimes(1);
    });

    it("trata contagem nula como zero", async () => {
      const { db } = dbCom({ count: null, error: null });
      expect((await listarClientes(db, {})).total).toBe(0);
    });

    it("busca a pagina pedida ordenando por criado_em e id (desc) com o intervalo certo", async () => {
      const { db, consultas } = dbCom({ count: 45, error: null }, { data: [CLIENTE], error: null });
      const lista = await listarClientes(db, { pagina: 2 });
      expect(lista).toEqual({ itens: [CLIENTE], total: 45, pagina: 2, totalPaginas: 3 });
      const { chamadas } = consultas[1];
      expect(chamou(chamadas, "order")).toEqual([
        ["order", ["criado_em", { ascending: false }]],
        ["order", ["id", { ascending: false }]],
      ]);
      expect(chamou(chamadas, "range")).toEqual([["range", [TAMANHO_PAGINA, 2 * TAMANHO_PAGINA - 1]]]);
    });

    it("limita a pagina ao total de paginas", async () => {
      const { db, consultas } = dbCom({ count: 45, error: null }, { data: [], error: null });
      const lista = await listarClientes(db, { pagina: 99 });
      expect(lista.pagina).toBe(3);
      expect(chamou(consultas[1].chamadas, "range")).toEqual([["range", [40, 59]]]);
    });

    it.each([[undefined], [0], [-1], [1.5], [Number.NaN]])("pagina invalida %s vira 1", async (pagina) => {
      const { db, consultas } = dbCom({ count: 45, error: null }, { data: [], error: null });
      const lista = await listarClientes(db, { pagina });
      expect(lista.pagina).toBe(1);
      expect(chamou(consultas[1].chamadas, "range")).toEqual([["range", [0, TAMANHO_PAGINA - 1]]]);
    });

    it("aplica busca e status validos nas duas consultas", async () => {
      const { db, consultas } = dbCom({ count: 1, error: null }, { data: [CLIENTE], error: null });
      await listarClientes(db, { busca: "  ana  ", status: "cliente" });
      for (const { chamadas } of consultas) {
        expect(chamou(chamadas, "or")).toEqual([["or", [expressaoBusca("ana")]]]);
        expect(chamou(chamadas, "eq")).toEqual([["eq", ["status", "cliente"]]]);
      }
    });

    it("ignora busca em branco e status desconhecido", async () => {
      const { db, consultas } = dbCom({ count: 1, error: null }, { data: [CLIENTE], error: null });
      await listarClientes(db, { busca: "   ", status: "invalido" as never });
      for (const { chamadas } of consultas) {
        expect(chamou(chamadas, "or")).toHaveLength(0);
        expect(chamou(chamadas, "eq")).toHaveLength(0);
      }
    });

    it("erro na contagem lanca mensagem amigavel e registra codigo e detalhe", async () => {
      const { db } = dbCom({ error: { code: "42501", message: "negado" } });
      await expect(listarClientes(db, {})).rejects.toBeInstanceOf(ErroClientes);
      await expect(listarClientes(dbCom({ error: { code: "42501", message: "negado" } }).db, {})).rejects.toThrow(
        "Não foi possível listar os clientes.",
      );
      expect(console.error).toHaveBeenCalledTimes(2); // uma por chamada: o repositorio registra uma vez
      expect(console.error).toHaveBeenCalledWith(expect.any(String), "42501", "negado");
    });

    it("erro na listagem lanca mensagem amigavel", async () => {
      const { db } = dbCom({ count: 3, error: null }, { error: { code: "XX", message: "boom" } });
      await expect(listarClientes(db, {})).rejects.toThrow("Não foi possível listar os clientes.");
      expect(console.error).toHaveBeenCalledWith(expect.any(String), "XX", "boom");
    });
  });

  describe("criarCliente", () => {
    it("envia apenas os 7 campos editaveis e devolve o cliente criado", async () => {
      const { db, from, consultas } = dbCom({ data: CLIENTE, error: null });
      const input = { ...INPUT, empresa_id: "outra", id: "x" } as unknown as ClienteInput;
      expect(await criarCliente(db, input)).toBe(CLIENTE);
      expect(from).toHaveBeenCalledWith("clientes");
      const [[, [enviado]]] = chamou(consultas[0].chamadas, "insert");
      expect(Object.keys(enviado as object).sort()).toEqual(Object.keys(INPUT).sort());
    });

    it("erro do banco lanca mensagem amigavel", async () => {
      const { db } = dbCom({ error: { code: "23505", message: "dup" } });
      await expect(criarCliente(db, INPUT)).rejects.toThrow("Não foi possível criar o cliente.");
    });
  });

  describe("atualizarCliente", () => {
    it("atualiza pelo id com o payload filtrado e devolve o cliente", async () => {
      const { db, consultas } = dbCom({ data: CLIENTE, error: null });
      const input = { ...INPUT, empresa_id: "outra" } as unknown as ClienteInput;
      expect(await atualizarCliente(db, "c1", input)).toBe(CLIENTE);
      const { chamadas } = consultas[0];
      expect(chamou(chamadas, "eq")).toEqual([["eq", ["id", "c1"]]]);
      const [[, [enviado]]] = chamou(chamadas, "update");
      expect(enviado).toEqual(INPUT);
    });

    it("erro do banco (inclui RLS ao mover de empresa) lanca mensagem amigavel", async () => {
      const { db } = dbCom({ error: { code: "42501", message: "row-level security" } });
      await expect(atualizarCliente(db, "c1", INPUT)).rejects.toThrow("Não foi possível atualizar o cliente.");
    });
  });

  describe("excluirCliente", () => {
    it("remove pelo id", async () => {
      const { db, consultas } = dbCom({ error: null });
      await expect(excluirCliente(db, "c1")).resolves.toBeUndefined();
      expect(chamou(consultas[0].chamadas, "delete")).toHaveLength(1);
      expect(chamou(consultas[0].chamadas, "eq")).toEqual([["eq", ["id", "c1"]]]);
    });

    it("erro do banco lanca mensagem amigavel", async () => {
      const { db } = dbCom({ error: { code: "XX", message: "boom" } });
      await expect(excluirCliente(db, "c1")).rejects.toThrow("Não foi possível excluir o cliente.");
    });
  });
});
