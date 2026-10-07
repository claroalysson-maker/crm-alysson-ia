import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

const [fonte] = config.matcher;
const casa = (caminho: string) => new RegExp(`^${fonte}$`).test(caminho);

describe("matcher do proxy", () => {
  it.each(["/x.svg", "/a/logo.png", "/_next/static/a.js", "/_next/image", "/favicon.ico"])(
    "exclui %s",
    (c) => expect(casa(c)).toBe(false),
  );

  it.each(["/clientesvg", "/dashboard/xpng", "/clientes/logo-gif", "/dashboard", "/clientes", "/", "/login"])(
    "inclui %s",
    (c) => expect(casa(c)).toBe(true),
  );
});
