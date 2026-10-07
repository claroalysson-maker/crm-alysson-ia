import { beforeEach, describe, expect, it, vi } from "vitest";

const signIn = vi.fn();
const criarCliente = vi.fn();
const redirecionar = vi.fn((destino: string) => {
  throw new Error(`REDIRECT:${destino}`);
});

vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => criarCliente() }));
vi.mock("next/navigation", () => ({ redirect: (d: string) => redirecionar(d) }));

import { entrar } from "@/app/login/actions";

function form(email: string, senha: string) {
  const f = new FormData();
  f.set("email", email);
  f.set("senha", senha);
  return f;
}

const clienteOk = () => ({
  auth: {
    signInWithPassword: signIn,
    getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
    signOut: async () => ({ error: null }),
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: { empresa_id: "e1", papel: "admin" }, error: null }),
      }),
    }),
  }),
});

describe("entrar (server action)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn.mockResolvedValue({ error: null });
    criarCliente.mockImplementation(clienteOk);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("falha de validacao devolve mensagem e nao autentica", async () => {
    const r = await entrar({}, form("invalido", ""));
    expect(r.erro).toBe("Informe um e-mail e uma senha válidos");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("normaliza o e-mail antes de autenticar", async () => {
    await expect(entrar({}, form("  ANA@X.com ", "s"))).rejects.toThrow("REDIRECT:/dashboard");
    expect(signIn).toHaveBeenCalledWith({ email: "ana@x.com", password: "s" });
  });

  it("devolve o e-mail normalizado (nunca a senha) quando o login falha", async () => {
    signIn.mockResolvedValue({ error: { code: "invalid_credentials", message: "x" } });
    const r = await entrar({}, form("  ANA@X.com ", "s"));
    expect(r).toEqual({ erro: "E-mail ou senha incorretos", email: "ana@x.com" });
  });

  it("falha ao criar o cliente devolve mensagem amigavel", async () => {
    criarCliente.mockRejectedValue(new Error("env ausente"));
    const r = await entrar({}, form("a@b.com", "s"));
    expect(r.erro).toBe("Não foi possível entrar agora. Tente novamente.");
  });
});
