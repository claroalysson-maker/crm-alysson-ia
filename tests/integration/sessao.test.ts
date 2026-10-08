import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clienteAnonimo,
  criarEmpresaComUsuario,
  criarUsuarioSemEmpresa,
  limparEmpresaComUsuario,
  limparUsuario,
  type EmpresaComUsuario,
} from "./helpers";
import { obterSessao } from "@/lib/supabase/session";
import { autenticar } from "@/lib/login";

const sufixo = randomUUID().slice(0, 8);
const senha = `Senha-${randomUUID()}`;
const emailEmpresa = `sessao-${sufixo}@teste.invalid`;
const emailSemEmpresa = `sem-empresa-${sufixo}@teste.invalid`;

describe("sessao e login", () => {
  let empresa: EmpresaComUsuario;
  let semEmpresaId: string;

  beforeAll(async () => {
    empresa = await criarEmpresaComUsuario("Empresa Sessao", emailEmpresa, senha);
    semEmpresaId = (await criarUsuarioSemEmpresa(emailSemEmpresa, senha)).usuarioId;
  });

  afterAll(async () => {
    const resultados = await Promise.allSettled([
      empresa ? limparEmpresaComUsuario(empresa) : Promise.resolve(),
      semEmpresaId ? limparUsuario(semEmpresaId) : Promise.resolve(),
    ]);
    const falhas = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (falhas.length > 0) {
      throw new Error(`Falha na limpeza: ${falhas.map((f) => String(f.reason)).join("; ")}`);
    }
  });

  describe("obterSessao", () => {
    it("devolve null sem sessao", async () => {
      expect(await obterSessao(clienteAnonimo())).toBeNull();
    });

    it("devolve empresa, usuario e papel com sessao valida", async () => {
      const sessao = await obterSessao(empresa.clienteSupabase);
      expect(sessao).toEqual({
        usuarioId: empresa.usuarioId,
        empresaId: empresa.empresaId,
        papel: "admin",
      });
    });

    it("devolve null para usuario autenticado sem perfil", async () => {
      const db = clienteAnonimo();
      const { error } = await db.auth.signInWithPassword({ email: emailSemEmpresa, password: senha });
      expect(error).toBeNull();
      expect(await obterSessao(db)).toBeNull();
    });
  });

  describe("autenticar", () => {
    it("aceita credenciais validas", async () => {
      const db = clienteAnonimo();
      expect(await autenticar(db, emailEmpresa, senha)).toEqual({});
      expect(await obterSessao(db)).not.toBeNull();
    });

    it("senha errada devolve mensagem fixa", async () => {
      expect(await autenticar(clienteAnonimo(), emailEmpresa, "errada")).toEqual({
        erro: "E-mail ou senha incorretos",
      });
    });

    it("e-mail inexistente devolve a mesma mensagem", async () => {
      expect(await autenticar(clienteAnonimo(), `nao-existe-${sufixo}@teste.invalid`, senha)).toEqual({
        erro: "E-mail ou senha incorretos",
      });
    });

    it("usuario sem empresa recebe erro e fica deslogado", async () => {
      const db = clienteAnonimo();
      expect(await autenticar(db, emailSemEmpresa, senha)).toEqual({
        erro: "Sua conta não está vinculada a uma empresa",
      });
      const { data } = await db.auth.getSession();
      expect(data.session).toBeNull();
    });
  });
});
