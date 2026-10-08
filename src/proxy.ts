import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getEnv } from "@/lib/env";
import { processarRequisicao } from "@/lib/proxy/processar-requisicao";

export async function proxy(request: NextRequest) {
  const env = getEnv();
  return processarRequisicao(request, (cookies) =>
    createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { cookies }),
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
