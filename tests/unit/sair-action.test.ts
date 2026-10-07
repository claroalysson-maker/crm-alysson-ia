import { beforeEach, describe, expect, it, vi } from "vitest";

const signOut = vi.fn();
const redirecionar = vi.fn((destino: string) => {
  throw new Error(`REDIRECT:${destino}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({ auth: { signOut } }),
}));
vi.mock("next/navigation", () => ({ redirect: (d: string) => redirecionar(d) }));

import { sair } from "@/app/(app)/actions";

describe("sair (server action)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("encerra a sessao local e redireciona para /login", async () => {
    signOut.mockResolvedValue({ error: null });
    await expect(sair()).rejects.toThrow("REDIRECT:/login");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("redireciona para /login mesmo se signOut devolver erro, registrando no servidor", async () => {
    signOut.mockResolvedValue({ error: { message: "falhou" } });
    await expect(sair()).rejects.toThrow("REDIRECT:/login");
    expect(console.error).toHaveBeenCalled();
  });

  it("redireciona para /login mesmo se signOut lancar", async () => {
    signOut.mockRejectedValue(new Error("rede"));
    await expect(sair()).rejects.toThrow("REDIRECT:/login");
    expect(console.error).toHaveBeenCalled();
  });
});
