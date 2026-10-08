import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { CABECALHOS_SEGURANCA } from "@/lib/cabecalhos-seguranca";

describe("cabecalhos de seguranca", () => {
  it("define os quatro cabecalhos esperados", () => {
    expect(Object.fromEntries(CABECALHOS_SEGURANCA.map((h) => [h.key, h.value]))).toEqual({
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });

  it("o next.config aplica a lista a todas as rotas e desliga X-Powered-By", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(await nextConfig.headers?.()).toEqual([{ source: "/:path*", headers: CABECALHOS_SEGURANCA }]);
  });
});
