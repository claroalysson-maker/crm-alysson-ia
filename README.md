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

O `.env.example` (versionado) lista só os nomes `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `TEST_SUPABASE_PROJECT_REF`, sem valores. As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` existem apenas no `.env.test.local`, que o git ignora, e **nunca** devem ser copiadas para o `.env.example`.

O E2E (`npm run test:e2e`) também exige `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` do **projeto de testes** no ambiente do comando (o app é construído com eles), além de `TEST_SUPABASE_PROJECT_REF`. O Playwright recusa começar se qualquer uma das duas URLs não bater com essa referência.

`TEST_SUPABASE_PROJECT_REF` é a referência do projeto de testes (o trecho inicial da URL do Supabase). A guarda que compara essa referência com `SUPABASE_URL` apenas evita execuções acidentais, não é uma proteção de segurança. O projeto usado nos testes deve ser um projeto Supabase de desenvolvimento, dedicado a isso, nunca o de produção: os testes criam e removem empresas, usuários e clientes usando a chave service role.

## Como o acesso é criado

Não há cadastro (signup) no app. O dono do sistema cria o acesso manualmente pelo painel do Supabase:

1. Cria a empresa na tabela `empresas`.
2. Cria o usuário em Authentication.
3. Cria o perfil na tabela `perfis`, ligando o usuário à empresa e definindo o papel (`admin` ou `membro`).

Usuários sem perfil são deslogados e não acessam o app.

**Primeiro acesso.** Ao criar o perfil de um usuário novo com senha temporária, defina `precisa_trocar_senha = true` (padrão: `false`). No primeiro login ele é levado a `/definir-senha` e não acessa o resto do app até escolher uma nova senha. Requer a migração `0005_precisa_trocar_senha.sql`. A obrigatoriedade é de interface, não uma barreira de segurança: o usuário autenticado consegue chamar `concluir_troca_senha()` direto, sem trocar a senha.

## Migrations

O esquema do banco (tabelas, políticas RLS e a função de indicadores) fica em [`supabase/migrations`](supabase/migrations), em ordem numérica. Aplique-as no projeto Supabase antes de usar o app.

## Deploy

O arquivo `.env.example` lista apenas os nomes das variáveis, sem valores.

1. **Projeto Supabase de produção.** Produção é o projeto `alysson-ia`, e os testes usam um projeto separado, `alysson-ia-test` (desenvolvimento, dedicado). Nunca aponte os testes para o de produção. Estado das migrations: o projeto de testes (`alysson-ia-test`) já tem `0001` a `0004`; o de produção (`alysson-ia`) tem `0001` a `0003`, e **falta a `0004`**. Em produção, aplique **somente a `0004`**, no SQL Editor ou pelo MCP do Supabase, e só depois da aprovação do dono: a `0001` e a `0003` não são idempotentes e a `0002` é um rename, então reaplicá-las falha com "already exists". Não use `supabase db push` em produção: as migrations foram aplicadas com nomes de versão próprios, e o `db push` tentaria reaplicar tudo. Para um projeto novo e vazio, aplique `0001` a `0004` em ordem. Depois, confira os advisors de Security e Performance. Se alguma service key já foi exposta em transcrições ou logs, rotacione-a antes de ir ao ar.
2. **Desative o cadastro aberto.** Em Authentication → Providers → Email, desligue "Allow new users to sign up" e mantenha "Confirm email" ligado. O app não tem tela de cadastro, mas a API de Auth aceita cadastros com a chave anon pública se isso não for desligado: um estranho não teria perfil (seria deslogado como "sem perfil") e não veria dados, mas poluiria `auth.users`, gastaria a cota de e-mails e seria um risco latente para políticas futuras.
3. **Criar acessos.** Em Authentication → Add user → "Create new user", informe e-mail e senha e marque "Auto Confirm User". Nunca use "Invite user": o app não tem página para definir senha nem callback. Depois insira a linha de `empresas` e a de `perfis` (usuário, empresa e papel) pelo SQL Editor ou com a service role.
4. **URLs de Auth.** Em Authentication → URL Configuration, defina a Site URL como o domínio de produção e adicione as redirect URLs de produção e de preview. Revise também Authentication → Rate Limits. Como o Preview da Vercel aponta para o projeto `alysson-ia-test`, repita nele as configurações dos passos 2 e 4 (cadastro aberto desligado, "Confirm email" ligado, Site URL e redirect URLs de preview) e rotacione a service key dele se ela já tiver sido exposta.
5. **Vercel.**
   - Defina `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os valores do projeto de produção em Production e com os do projeto de desenvolvimento em Preview. Esses valores são embutidos no build: faça um novo deploy após qualquer mudança.
   - Nunca coloque a service-role key na Vercel.
   - A região das funções está em `vercel.json` (`gru1`, São Paulo, perto do Supabase em sa-east-1).
   - Crie uma regra de rate limit no Vercel Firewall para `POST /login` (por exemplo, 10 requisições por minuto por IP). O `signInWithPassword` roda no servidor, então os limites por IP do Supabase enxergam os IPs de saída da Vercel e não protegem contra um único atacante.
6. **Teste de fumaça na URL publicada.** Login com sucesso; senha errada mostra a mensagem genérica; usuário sem perfil mostra a mensagem de conta não vinculada; criar, editar e excluir cliente; o dashboard reflete as mudanças; Sair; `/dashboard` redireciona para `/login` quando deslogado.
7. **Testes e produção.** Nunca rode `test:integration` nem o E2E com credenciais de produção. Use sempre o projeto `alysson-ia-test`: a guarda `TEST_SUPABASE_PROJECT_REF` só confere a ref que você mesmo declara (e o Playwright confere `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL` contra ela), então ela não substitui o cuidado.

### Desempenho (anotação)

Um carregamento completo faz cerca de 5 a 6 idas ao Supabase (proxy: `getUser` e `perfis`; layout: `getUser` e `perfis`; página: consulta). Otimizações possíveis depois: envolver `obterSessao` em `cache()` do React (uma validação por requisição) e usar `getClaims()` no proxy (valida o JWT localmente, sem chamar o Auth).
