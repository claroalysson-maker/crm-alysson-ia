import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { destinoInicial } from "@/lib/supabase/destino-inicial";

function db(getUser: unknown, perfil: unknown = { data: { empresa_id: "e", papel: "admin" }, error: null }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue(getUser) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(perfil) }) }) }),
  } as unknown as SupabaseClient;
}

describe("destinoInicial", () => {
  beforeEach(() => void vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("sessao valida vai para /dashboard", async () => {
    expect(await destinoInicial(db({ data: { user: { id: "u" } }, error: null }))).toBe("/dashboard");
  });

  it("sem sessao vai para /login", async () => {
    const sem = { data: { user: null }, error: { name: "AuthSessionMissingError", message: "x" } };
    expect(await destinoInicial(db(sem))).toBe("/login");
  });

  it("falha transitoria vai para /login e e registrada", async () => {
    const falha = { data: { user: null }, error: { name: "AuthRetryableFetchError", message: "503" } };
    expect(await destinoInicial(db(falha))).toBe("/login");
    expect(console.error).toHaveBeenCalled();
  });

  it("falha na consulta de perfis vai para /login", async () => {
    const ok = { data: { user: { id: "u" } }, error: null };
    expect(await destinoInicial(db(ok, { data: null, error: { message: "boom" } }))).toBe("/login");
  });
});
