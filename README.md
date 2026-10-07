# CRM

CRM multi-empresa (multi-tenant) para gestão de clientes. Cada empresa enxerga apenas os próprios dados: o isolamento é garantido por RLS (Row Level Security) no banco. O app tem login, dashboard com indicadores e cadastro de clientes.

## Stack

- Next.js 16 (App Router) e React 19
- Supabase (Postgres, Auth e RLS) com `@supabase/ssr`
- Tailwind CSS 4, shadcn/ui (Base UI) e Recharts
- Zod para validação
- Vitest (unitários e integração) e Playwright (E2E)

## Como rodar

1. Instale as dependências: `npm install`
2. Crie o arquivo `.env.local` com as variáveis públicas do seu projeto Supabase:

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ```

3. Inicie o servidor de desenvolvimento: `npm run dev` (http://localhost:3000)

Para gerar a versão de produção: `npm run build` e `npm start`.

## Testes

- `npm test`: testes unitários (não acessam rede nem banco).
- `npm run test:coverage`: unitários com cobertura; exige no mínimo 80% (linhas, funções, branches e statements).
- `npm run test:integration`: testes de integração contra um projeto Supabase real (RLS, repositório, sessão e indicadores).
- `npm run test:e2e`: testes E2E com Playwright.

Os testes de integração leem o arquivo `.env.test.local` (não versionado), com:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TEST_SUPABASE_PROJECT_REF=
```

`TEST_SUPABASE_PROJECT_REF` é a referência do projeto de testes (o trecho inicial da URL do Supabase). A guarda que compara essa referência com `SUPABASE_URL` apenas evita execuções acidentais, não é uma proteção de segurança. O projeto usado nos testes deve ser um projeto Supabase de desenvolvimento, dedicado a isso, nunca o de produção: os testes criam e removem empresas, usuários e clientes usando a chave service role.

## Como o acesso é criado

Não há cadastro (signup) no app. O dono do sistema cria o acesso manualmente pelo painel do Supabase:

1. Cria a empresa na tabela `empresas`.
2. Cria o usuário em Authentication.
3. Cria o perfil na tabela `perfis`, ligando o usuário à empresa e definindo o papel (`admin` ou `membro`).

Usuários sem perfil são deslogados e não acessam o app.

## Migrations

O esquema do banco (tabelas, políticas RLS e a função de indicadores) fica em [`supabase/migrations`](supabase/migrations), em ordem numérica. Aplique-as no projeto Supabase antes de usar o app.
