import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
const RLS = /row-level security/i;

describe("isolamento multi-tenant (RLS)", () => {
  let a: EmpresaComUsuario;
  let b: EmpresaComUsuario;
  let clienteAId: string;
  let clienteBId: string;
  let semEmpresaId: string | undefined;
  const emailSemEmpresa = `sem-perfil-${sufixo}@teste.invalid`;

  beforeAll(async () => {
    a = await criarEmpresaComUsuario("Empresa A", `a-${sufixo}@teste.invalid`, senha);
    b = await criarEmpresaComUsuario("Empresa B", `b-${sufixo}@teste.invalid`, senha);
    semEmpresaId = (await criarUsuarioSemEmpresa(emailSemEmpresa, senha)).usuarioId;

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
    const resultados = await Promise.allSettled([
      ...[a, b].filter(Boolean).map((e) => limparEmpresaComUsuario(e)),
      semEmpresaId ? limparUsuario(semEmpresaId) : Promise.resolve(),
    ]);
    const falhas = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (falhas.length > 0) {
      throw new Error(falhas.map((f) => (f.reason as Error).message).join(" | "));
    }
  });

  it("usuario A lista clientes e ve apenas os da empresa A", async () => {
    const { data, error } = await a.clienteSupabase.from("clientes").select("id, empresa_id");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((c) => c.empresa_id === a.empresaId)).toBe(true);
    expect(data!.map((c) => c.id)).toContain(clienteAId);
    expect(data!.map((c) => c.id)).not.toContain(clienteBId);
  });

  it("usuario B lista clientes e ve apenas os da empresa B", async () => {
    const { data, error } = await b.clienteSupabase.from("clientes").select("id, empresa_id");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((c) => c.empresa_id === b.empresaId)).toBe(true);
    expect(data!.map((c) => c.id)).toContain(clienteBId);
    expect(data!.map((c) => c.id)).not.toContain(clienteAId);
  });

  it("usuario A nao consegue mover o proprio cliente para a empresa B", async () => {
    const { error } = await a.clienteSupabase
      .from("clientes")
      .update({ empresa_id: b.empresaId })
      .eq("id", clienteAId)
      .select();
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(RLS);

    const { data: depois } = await clienteServico()
      .from("clientes").select("empresa_id").eq("id", clienteAId).single();
    expect(depois?.empresa_id).toBe(a.empresaId);
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

  it("usuario B nao consegue atualizar cliente da empresa A", async () => {
    const { data, error } = await b.clienteSupabase
      .from("clientes").update({ nome: "Invadido" }).eq("id", clienteAId).select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: intacto } = await clienteServico()
      .from("clientes").select("nome, empresa_id").eq("id", clienteAId).single();
    expect(intacto).toEqual({ nome: "Cliente A", empresa_id: a.empresaId });
  });

  it("usuario B nao consegue apagar cliente da empresa A", async () => {
    const { data, error } = await b.clienteSupabase
      .from("clientes").delete().eq("id", clienteAId).select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: intacto } = await clienteServico()
      .from("clientes").select("id").eq("id", clienteAId);
    expect(intacto).toHaveLength(1);
  });

  it("usuario A nao consegue inserir cliente com empresa_id da empresa B", async () => {
    const { error } = await a.clienteSupabase
      .from("clientes")
      .insert({ empresa_id: b.empresaId, nome: "Intruso" });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(RLS);
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

    const { data: datada, error: erroData } = await a.clienteSupabase
      .from("empresas").select("criada_em").eq("id", a.empresaId).single();
    expect(erroData).toBeNull();
    expect(datada?.criada_em).toEqual(expect.any(String));
  });

  it("usuario A le perfis e ve apenas o proprio", async () => {
    const { data, error } = await a.clienteSupabase.from("perfis").select("usuario_id");
    expect(error).toBeNull();
    expect(data).toEqual([{ usuario_id: a.usuarioId }]);
  });

  describe("perfis e empresas sao somente leitura para usuarios", () => {
    it("usuario A nao consegue alterar o proprio papel", async () => {
      const { data } = await a.clienteSupabase
        .from("perfis").update({ papel: "membro" }).eq("usuario_id", a.usuarioId).select();
      expect(data ?? []).toHaveLength(0);

      const { data: depois } = await clienteServico()
        .from("perfis").select("papel, empresa_id").eq("usuario_id", a.usuarioId).single();
      expect(depois).toEqual({ papel: "admin", empresa_id: a.empresaId });
    });

    it("usuario A nao consegue mover o proprio perfil para a empresa B", async () => {
      const { data } = await a.clienteSupabase
        .from("perfis").update({ empresa_id: b.empresaId }).eq("usuario_id", a.usuarioId).select();
      expect(data ?? []).toHaveLength(0);

      const { data: depois } = await clienteServico()
        .from("perfis").select("empresa_id").eq("usuario_id", a.usuarioId).single();
      expect(depois?.empresa_id).toBe(a.empresaId);
    });

    it("usuario A nao consegue inserir perfil", async () => {
      const { error } = await a.clienteSupabase
        .from("perfis")
        .insert({ usuario_id: semEmpresaId, empresa_id: a.empresaId, papel: "admin" });
      expect(error).not.toBeNull();

      const { data } = await clienteServico()
        .from("perfis").select("usuario_id").eq("usuario_id", semEmpresaId!);
      expect(data).toHaveLength(0);
    });

    it("usuario A nao consegue apagar o proprio perfil", async () => {
      const { data } = await a.clienteSupabase
        .from("perfis").delete().eq("usuario_id", a.usuarioId).select();
      expect(data ?? []).toHaveLength(0);

      const { data: depois } = await clienteServico()
        .from("perfis").select("usuario_id").eq("usuario_id", a.usuarioId);
      expect(depois).toHaveLength(1);
    });

    it("usuario A nao consegue atualizar nem apagar empresas (propria ou da B)", async () => {
      for (const id of [a.empresaId, b.empresaId]) {
        const { data: atualizada } = await a.clienteSupabase
          .from("empresas").update({ nome: "Renomeada" }).eq("id", id).select();
        expect(atualizada ?? []).toHaveLength(0);
        const { data: apagada } = await a.clienteSupabase
          .from("empresas").delete().eq("id", id).select();
        expect(apagada ?? []).toHaveLength(0);
      }

      const { data } = await clienteServico()
        .from("empresas").select("id, nome").in("id", [a.empresaId, b.empresaId]);
      expect(data!.map((e) => e.nome).sort()).toEqual(["Empresa A", "Empresa B"]);
    });

    it("usuario A nao consegue inserir empresa", async () => {
      const nome = `Intrusa ${sufixo}`;
      const { error } = await a.clienteSupabase.from("empresas").insert({ nome });
      expect(error).not.toBeNull();

      const { data } = await clienteServico().from("empresas").select("id").eq("nome", nome);
      expect(data).toHaveLength(0);
    });
  });

  describe("acesso anonimo (sem login)", () => {
    it.each(["clientes", "perfis", "empresas"])("nao le %s", async (tabela) => {
      const { data } = await clienteAnonimo().from(tabela).select("*");
      // Com ou sem erro de permissao (depende dos grants), nenhuma linha pode vazar.
      expect(data ?? []).toHaveLength(0);
    });

    it("nao insere em clientes", async () => {
      const { error } = await clienteAnonimo()
        .from("clientes").insert({ empresa_id: a.empresaId, nome: "Anonimo" });
      expect(error).not.toBeNull();

      const { data } = await clienteServico().from("clientes").select("id").eq("nome", "Anonimo");
      expect(data).toHaveLength(0);
    });

    it("nao insere em perfis", async () => {
      const { error } = await clienteAnonimo()
        .from("perfis")
        .insert({ usuario_id: semEmpresaId, empresa_id: a.empresaId, papel: "admin" });
      expect(error).not.toBeNull();

      const { data } = await clienteServico()
        .from("perfis").select("usuario_id").eq("usuario_id", semEmpresaId!);
      expect(data).toHaveLength(0);
    });

    it("nao insere em empresas", async () => {
      const nome = `Anonima ${sufixo}`;
      const { error } = await clienteAnonimo().from("empresas").insert({ nome });
      expect(error).not.toBeNull();

      const { data } = await clienteServico().from("empresas").select("id").eq("nome", nome);
      expect(data).toHaveLength(0);
    });
  });

  describe("usuario autenticado sem perfil", () => {
    it("nao ve clientes e nao consegue inserir cliente", async () => {
      const db = clienteAnonimo();
      const { error: erroLogin } = await db.auth.signInWithPassword({
        email: emailSemEmpresa,
        password: senha,
      });
      expect(erroLogin).toBeNull();

      const { data, error } = await db.from("clientes").select("id");
      expect(error).toBeNull();
      expect(data).toHaveLength(0);

      // empresa_id explicito de empresa existente: sem a policy clientes_insert o insert
      // passaria; omiti-lo falharia por NOT NULL mesmo sem policy (teste vacuo).
      const { error: erroInsert } = await db
        .from("clientes").insert({ empresa_id: a.empresaId, nome: "Sem perfil" });
      expect(erroInsert).not.toBeNull();
      expect(erroInsert!.message).toMatch(RLS);

      const { data: criado } = await clienteServico()
        .from("clientes").select("id").eq("nome", "Sem perfil");
      expect(criado).toHaveLength(0);
    });
  });
});
