import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buscarIndicadores } from "@/lib/indicadores";
import {
  clienteAnonimo,
  clienteServico,
  criarEmpresaComUsuario,
  criarUsuarioSemEmpresa,
  limparEmpresaComUsuario,
  limparUsuario,
  type EmpresaComUsuario,
} from "./helpers";

const sufixo = randomUUID().slice(0, 8);
const senha = `Senha-${randomUUID()}`;
const AGORA = new Date("2026-10-07T15:00:00Z"); // semana atual: 2026-10-05
const TAMANHO_LOTE = 500;
const SEM_PERMISSAO = "42501"; // insufficient_privilege (permission denied)

type Semente = {
  empresa_id: string;
  nome: string;
  status: "lead" | "cliente" | "perdido";
  valor_estimado: number;
  criado_em: string;
};

async function inserir(linhas: Semente[]): Promise<void> {
  const servico = clienteServico();
  for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
    const { error } = await servico.from("clientes").insert(linhas.slice(i, i + TAMANHO_LOTE));
    if (error) throw new Error(`Falha ao semear clientes: ${error.message}`);
  }
}

function lote(
  empresa_id: string,
  quantidade: number,
  status: Semente["status"],
  valor_estimado: number,
  criado_em: string,
): Semente[] {
  return Array.from({ length: quantidade }, (_, i) => ({
    empresa_id,
    nome: `Ind ${status} ${i}`,
    status,
    valor_estimado,
    criado_em,
  }));
}

describe("indicadores_empresa", () => {
  let a: EmpresaComUsuario;
  let b: EmpresaComUsuario;
  let semPerfilId: string | undefined;
  const emailSemPerfil = `ind-sem-perfil-${sufixo}@teste.invalid`;

  beforeAll(async () => {
    a = await criarEmpresaComUsuario("Ind A", `ind-a-${sufixo}@teste.invalid`, senha);
    b = await criarEmpresaComUsuario("Ind B", `ind-b-${sufixo}@teste.invalid`, senha);
    semPerfilId = (await criarUsuarioSemEmpresa(emailSemPerfil, senha)).usuarioId;

    const naSemana = "2026-10-06T12:00:00Z";
    await inserir([
      // 1050 clientes em proporção conhecida: 600 leads (R$ 1), 300 clientes, 150 perdidos (R$ 100).
      ...lote(a.empresaId, 600, "lead", 1, naSemana),
      ...lote(a.empresaId, 300, "cliente", 50, naSemana),
      ...lote(a.empresaId, 150, "perdido", 100, naSemana),
      // Fronteira de semana: domingo 23:59:59 e segunda 00:00:00 (UTC).
      ...lote(a.empresaId, 1, "lead", 0, "2026-10-04T23:59:59Z"),
      ...lote(a.empresaId, 1, "lead", 0, "2026-10-05T00:00:00Z"),
      // Fora da janela de 8 semanas: conta nos totais, não no gráfico.
      ...lote(a.empresaId, 1, "cliente", 0, "2026-07-01T12:00:00Z"),
      // Bordas da janela (8 semanas: 2026-08-17 .. 2026-10-05): a semana mais antiga incluída
      // (segunda 00:00:00Z) e o último instante da semana anterior (domingo 23:59:59Z).
      ...lote(a.empresaId, 1, "lead", 0, "2026-08-17T00:00:00Z"),
      ...lote(a.empresaId, 1, "lead", 0, "2026-08-16T23:59:59Z"),
      // Semana seguinte à atual: fora do gráfico, mas conta nos totais.
      ...lote(a.empresaId, 1, "lead", 0, "2026-10-13T12:00:00Z"),
      // Empresa B: não pode aparecer em A.
      ...lote(b.empresaId, 7, "lead", 5000, naSemana),
    ]);
  }, 120000);

  afterAll(async () => {
    const resultados = await Promise.allSettled([
      ...[a, b].filter(Boolean).map((e) => limparEmpresaComUsuario(e)),
      semPerfilId ? limparUsuario(semPerfilId) : Promise.resolve(),
    ]);
    const falhas = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (falhas.length > 0) {
      throw new Error(falhas.map((f) => (f.reason as Error).message).join(" | "));
    }
    const { count, error } = await clienteServico()
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .in("empresa_id", [a?.empresaId, b?.empresaId].filter(Boolean) as string[]);
    if (error) throw new Error(`Falha ao conferir limpeza: ${error.message}`);
    expect(count).toBe(0);
  });

  it("reporta totais exatos para mais de 1000 clientes, sem truncar", async () => {
    const r = await buscarIndicadores(a.clienteSupabase, AGORA);
    expect(r.porStatus).toEqual({ lead: 605, cliente: 301, perdido: 150 });
    expect(r.totalLeads).toBe(605);
    expect(r.totalClientes).toBe(301);
  });

  it("não conta dados de outra empresa, nem no valor", async () => {
    const r = await buscarIndicadores(a.clienteSupabase, AGORA);
    expect(r.valorEmNegociacao).toBe(600);
    const deB = await buscarIndicadores(b.clienteSupabase, AGORA);
    expect(deB.porStatus).toEqual({ lead: 7, cliente: 0, perdido: 0 });
    expect(deB.valorEmNegociacao).toBe(35000);
  });

  it("exclui perdido do valor e da taxa", async () => {
    const r = await buscarIndicadores(a.clienteSupabase, AGORA);
    expect(r.taxaConversao).toBeCloseTo(301 / (605 + 301), 10);
  });

  it("separa domingo 23:59:59 UTC de segunda 00:00:00 UTC em semanas distintas", async () => {
    const r = await buscarIndicadores(a.clienteSupabase, AGORA);
    const porSemana = Object.fromEntries(r.leadsPorSemana.map((s) => [s.semanaInicio, s.total]));
    expect(r.leadsPorSemana).toHaveLength(8);
    expect(porSemana["2026-09-28"]).toBe(1);
    expect(porSemana["2026-10-05"]).toBe(1051);
  });

  it("cliente com mais de 8 semanas entra nos totais mas não no gráfico", async () => {
    const r = await buscarIndicadores(a.clienteSupabase, AGORA);
    const somaGrafico = r.leadsPorSemana.reduce((acc, s) => acc + s.total, 0);
    expect(somaGrafico).toBe(1053);
    expect(r.totalClientes).toBe(301);
  });

  it("fixa as bordas da janela: semana mais antiga incluída, semana anterior a ela fora", async () => {
    const r = await buscarIndicadores(a.clienteSupabase, AGORA);
    const porSemana = Object.fromEntries(r.leadsPorSemana.map((s) => [s.semanaInicio, s.total]));
    expect(r.leadsPorSemana[0].semanaInicio).toBe("2026-08-17");
    expect(porSemana["2026-08-17"]).toBe(1); // segunda 00:00:00Z da semana mais antiga
    expect(porSemana["2026-08-10"]).toBeUndefined(); // domingo 23:59:59Z anterior não entra
  });

  it("lead da semana seguinte fica fora do gráfico, mas conta nos totais", async () => {
    const r = await buscarIndicadores(a.clienteSupabase, AGORA);
    const semanas = r.leadsPorSemana.map((s) => s.semanaInicio);
    expect(semanas.at(-1)).toBe("2026-10-05");
    expect(semanas).not.toContain("2026-10-12");
    // 600 + 1 (domingo) + 1 (segunda) + 1 (borda antiga) + 1 (semana seguinte) + 1 (anterior à janela)
    expect(r.totalLeads).toBe(605);
  });

  it("anônimo não consegue executar a função", async () => {
    const { error } = await clienteAnonimo().rpc("indicadores_empresa", {
      p_agora: AGORA.toISOString(),
    });
    expect(error?.code).toBe(SEM_PERMISSAO);
    expect(error?.message).toMatch(/permission denied/i);
  });

  it("usuário sem perfil recebe zeros (RLS não devolve linhas)", async () => {
    const db = clienteAnonimo();
    const { error } = await db.auth.signInWithPassword({ email: emailSemPerfil, password: senha });
    if (error) throw new Error(`Falha ao autenticar usuário sem perfil: ${error.message}`);
    const r = await buscarIndicadores(db, AGORA);
    expect(r.porStatus).toEqual({ lead: 0, cliente: 0, perdido: 0 });
    expect(r.valorEmNegociacao).toBe(0);
    expect(r.leadsPorSemana.every((s) => s.total === 0)).toBe(true);
  });
});
