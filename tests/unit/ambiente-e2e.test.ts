import { describe, expect, it } from "vitest";
import { validarAmbienteE2E } from "../e2e/ambiente";

const REF = "abc123";
const ok = {
  SUPABASE_URL: `https://${REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
  TEST_SUPABASE_PROJECT_REF: REF,
};

describe("validarAmbienteE2E", () => {
  it("aceita quando as duas URLs apontam para o projeto de teste", () => {
    expect(() => validarAmbienteE2E(ok)).not.toThrow();
  });

  it("recusa quando a URL publica (embutida no build) aponta para outro projeto", () => {
    expect(() =>
      validarAmbienteE2E({ ...ok, NEXT_PUBLIC_SUPABASE_URL: "https://prod999.supabase.co" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL.*prod999/);
  });

  it("recusa quando SUPABASE_URL (service-role) aponta para outro projeto", () => {
    expect(() => validarAmbienteE2E({ ...ok, SUPABASE_URL: "https://prod999.supabase.co" })).toThrow(
      /^SUPABASE_URL: .*prod999/,
    );
  });

  it.each(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"])("recusa quando %s esta ausente", (nome) => {
    expect(() => validarAmbienteE2E({ ...ok, [nome]: undefined })).toThrow(new RegExp(nome));
  });

  it("recusa quando TEST_SUPABASE_PROJECT_REF esta ausente", () => {
    expect(() => validarAmbienteE2E({ ...ok, TEST_SUPABASE_PROJECT_REF: undefined })).toThrow(
      /TEST_SUPABASE_PROJECT_REF/,
    );
  });
});
