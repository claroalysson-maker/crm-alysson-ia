import { describe, expect, it } from "vitest";
import { validarProjetoDeTeste } from "../integration/projeto-de-teste";

describe("validarProjetoDeTeste", () => {
  it("aceita quando a ref da URL e a esperada coincidem", () => {
    expect(() => validarProjetoDeTeste("https://abc123.supabase.co", "abc123")).not.toThrow();
  });

  it("falha nomeando as duas refs quando diferem", () => {
    expect(() => validarProjetoDeTeste("https://prod999.supabase.co", "abc123")).toThrow(
      /prod999.*abc123|abc123.*prod999/,
    );
  });

  it("falha quando TEST_SUPABASE_PROJECT_REF esta ausente ou vazia", () => {
    expect(() => validarProjetoDeTeste("https://abc123.supabase.co", undefined)).toThrow(
      /TEST_SUPABASE_PROJECT_REF/,
    );
    expect(() => validarProjetoDeTeste("https://abc123.supabase.co", "")).toThrow(
      /TEST_SUPABASE_PROJECT_REF/,
    );
  });

  it("falha quando a URL nao tem o formato supabase.co", () => {
    expect(() => validarProjetoDeTeste("http://localhost:54321", "abc123")).toThrow(/SUPABASE_URL/);
    expect(() => validarProjetoDeTeste("nao-e-url", "abc123")).toThrow(/SUPABASE_URL/);
  });

  it("nao aceita subdominio extra que apenas termina com a ref", () => {
    expect(() => validarProjetoDeTeste("https://x.abc123.supabase.co", "abc123")).toThrow();
  });

  it("aceita barra final e host em maiusculas (comparacao sem diferenciar caixa)", () => {
    expect(() => validarProjetoDeTeste("https://abc123.supabase.co/", "abc123")).not.toThrow();
    expect(() => validarProjetoDeTeste("https://ABC123.Supabase.co", "abc123")).not.toThrow();
    expect(() => validarProjetoDeTeste("https://abc123.supabase.co", "ABC123")).not.toThrow();
  });

  it.each([
    "https://user:pw@abc123.supabase.co",
    "https://abc123.supabase.co/x",
    "https://abc123.supabase.co:8443",
    "http://abc123.supabase.co",
    "https://x.abc123.supabase.co",
  ])("rejeita %s", (url) => {
    expect(() => validarProjetoDeTeste(url, "abc123")).toThrow(/SUPABASE_URL/);
  });
});
