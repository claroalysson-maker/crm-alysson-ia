import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clienteServico,
  criarEmpresaComUsuario,
  limparEmpresaComUsuario,
  type EmpresaComUsuario,
} from "./helpers";

const sufixo = randomUUID().slice(0, 8);
const senha = `Senha-${randomUUID()}`;

describe("isolamento multi-tenant (RLS)", () => {
  let a: EmpresaComUsuario;
  let b: EmpresaComUsuario;
  let clienteAId: string;
  let clienteBId: string;

  beforeAll(async () => {
    a = await criarEmpresaComUsuario("Empresa A", `a-${sufixo}@teste.invalid`, senha);
    b = await criarEmpresaComUsuario("Empresa B", `b-${sufixo}@teste.invalid`, senha);

    const servico = clienteServico();
    const { data, error } = await servico
      .from("clientes")
      .insert([
        { empresa_id: a.empresaId, nome: "Cliente A" },
        { empresa_id: b.empresaId, nome: "Cliente B" },
      ])
      .select("id, empresa_id");
    if (error) throw new Error(`Falha ao semear clientes: ${error.message}`);
    clienteAId = data.find((c) => c.empresa_id === a.empresaId)!.id;
    clienteBId = data.find((c) => c.empresa_id === b.empresaId)!.id;
  });

  afterAll(async () => {
    if (a) await limparEmpresaComUsuario(a);
    if (b) await limparEmpresaComUsuario(b);
  });

  it("usuario A lista clientes e ve apenas os da empresa A", async () => {
    const { data, error } = await a.clienteSupabase.from("clientes").select("id, empresa_id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(clienteAId);
    expect(data!.filter((c) => c.empresa_id === b.empresaId)).toHaveLength(0);
  });

  it("usuario A nao consegue atualizar cliente da empresa B", async () => {
    const { data, error } = await a.clienteSupabase
      .from("clientes")
      .update({ nome: "Invadido" })
      .eq("id", clienteBId)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: intacto } = await clienteServico()
      .from("clientes").select("nome").eq("id", clienteBId).single();
    expect(intacto?.nome).toBe("Cliente B");
  });

  it("usuario A nao consegue apagar cliente da empresa B", async () => {
    const { data, error } = await a.clienteSupabase
      .from("clientes").delete().eq("id", clienteBId).select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: intacto } = await clienteServico()
      .from("clientes").select("id").eq("id", clienteBId);
    expect(intacto).toHaveLength(1);
  });

  it("usuario A nao consegue inserir cliente com empresa_id da empresa B", async () => {
    const { error } = await a.clienteSupabase
      .from("clientes")
      .insert({ empresa_id: b.empresaId, nome: "Intruso" });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/row-level security/i);
  });

  it("insert sem empresa_id grava automaticamente a empresa A", async () => {
    const { data, error } = await a.clienteSupabase
      .from("clientes").insert({ nome: "Automatico" }).select("empresa_id").single();
    expect(error).toBeNull();
    expect(data?.empresa_id).toBe(a.empresaId);
  });

  it("cliente com empresa_contato e notas faz round-trip", async () => {
    const { data, error } = await a.clienteSupabase
      .from("clientes")
      .insert({ nome: "Completo", empresa_contato: "Acme Ltda", notas: "Ligar na segunda" })
      .select("empresa_contato, notas")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ empresa_contato: "Acme Ltda", notas: "Ligar na segunda" });
  });

  it("usuario A le empresas e ve apenas a propria", async () => {
    const { data, error } = await a.clienteSupabase.from("empresas").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: a.empresaId }]);
  });

  it("usuario A le perfis e ve apenas o proprio", async () => {
    const { data, error } = await a.clienteSupabase.from("perfis").select("usuario_id");
    expect(error).toBeNull();
    expect(data).toEqual([{ usuario_id: a.usuarioId }]);
  });
});
