import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const PASTA_AUTH = path.resolve(__dirname, ".auth");
export const ARQUIVO_CREDENCIAIS = path.join(PASTA_AUTH, "credenciais.json");
export const ARQUIVO_SESSAO = path.join(PASTA_AUTH, "sessao.json");

export type Credenciais = {
  email: string;
  senha: string;
  empresaId: string;
  usuarioId: string;
};

export function salvarCredenciais(credenciais: Credenciais): void {
  mkdirSync(PASTA_AUTH, { recursive: true });
  writeFileSync(ARQUIVO_CREDENCIAIS, JSON.stringify(credenciais), "utf8");
}

export function lerCredenciais(): Credenciais {
  return JSON.parse(readFileSync(ARQUIVO_CREDENCIAIS, "utf8")) as Credenciais;
}
