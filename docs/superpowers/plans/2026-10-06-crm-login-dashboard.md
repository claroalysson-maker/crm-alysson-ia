# CRM SaaS: Login e Dashboard — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar login por e-mail e senha que dá acesso a um dashboard de CRM multi-empresa, com CRUD de clientes e leads e indicadores reais.

**Architecture:** App Next.js (App Router, TypeScript) na Vercel. Supabase Auth faz o login e Supabase Postgres guarda os dados, com RLS garantindo o isolamento entre empresas no banco. A lógica de indicadores e de busca fica em funções puras, testadas sem banco.

**Tech Stack:** Next.js, TypeScript, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Tailwind CSS, shadcn/ui, Recharts, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-06-crm-login-dashboard-design.md`

## Global Constraints

- Idioma da interface e dos nomes de tabelas e colunas: português, exatamente como na spec (`empresas`, `perfis`, `clientes`, `empresa_id`, `valor_estimado`, etc.).
- `status` de cliente: somente `lead`, `cliente` ou `perdido`. `papel` de perfil: somente `admin` ou `membro`.
- Sem cadastro aberto: nenhuma tela ou rota de signup.
- Mensagem de falha de login: exatamente `E-mail ou senha incorretos`, sem revelar qual campo errou.
- Paginação: 20 registros por página.
- Gráfico de leads por semana: últimas 8 semanas.
- A chave de serviço do Supabase nunca é importada em código que roda no navegador. Segredos só em variáveis de ambiente, verificadas na inicialização.
- Entradas de formulário validadas no servidor com Zod.
- Cobertura mínima: 80%. TDD: teste antes do código.
- Tema escuro, destaque azul-violeta, fonte Inter, cores num único arquivo de tema, layout responsivo.

## Review Focus

1. Usuário autenticado sem linha em `perfis` (sem empresa): deve voltar ao login com erro claro, sem quebrar a página. Testado na Task 3.
2. Busca com `%`, `_`, `,`, `(` ou `)` no termo: deve ser tratada como texto literal, sem quebrar o filtro nem retornar tudo. Testado na Task 4.
3. Página pedida além da última (`?page=999`) ou inválida (`?page=abc`): deve mostrar a última página ou a primeira, sem erro. Testado na Task 4 (repositório) e coberto na tela da Task 5.
4. Indicadores com zero clientes e zero leads, ou só `perdido`: taxa de conversão 0% e sem divisão por zero. Testado na Task 6.
5. `valor_estimado` vazio, negativo ou com mais de duas casas decimais: vazio vira 0, negativo é rejeitado, ambos com mensagem clara. Testado na Task 4.

---

## Estrutura de arquivos

```
proxy.ts                         # proteção de rotas (nome do arquivo conforme a versão do Next instalada)
supabase/migrations/0001_schema_rls.sql
src/lib/env.ts                   # validação das variáveis de ambiente
src/lib/supabase/{server,browser,session}.ts
src/lib/clientes/{schema,busca,repositorio}.ts
src/lib/indicadores.ts           # cálculos puros
src/app/login/{page.tsx,actions.ts}
src/app/(app)/layout.tsx         # casca: menu lateral + sair
src/app/(app)/dashboard/page.tsx
src/app/(app)/clientes/{page.tsx,actions.ts}
src/components/{ui/*,clientes/*,dashboard/*}
src/styles/tema.css              # tokens de cor
tests/{unit,integration,e2e}/
```

---

### Task 1: Scaffold, ferramentas de teste e validação de ambiente

**Files:**
- Create: projeto Next.js em `C:\Users\claro\alysson-ia` (rodar `create-next-app` em `.`; TypeScript, App Router, Tailwind, `src/`), `vitest.config.ts`, `playwright.config.ts`, `src/lib/env.ts`, `src/styles/tema.css`, `.env.example`, `.gitignore`
- Test: `tests/unit/env.test.ts`

**Interfaces:**
- Produces: `getEnv(source?: Record<string, string | undefined>): { SUPABASE_URL: string; SUPABASE_ANON_KEY: string }` — lança `Error` com o nome da variável ausente. O parâmetro `source` existe para teste (padrão `process.env`). A chave de serviço não entra aqui: só os testes de integração a usam.

- [ ] **Step 1:** `git init`, rodar `create-next-app` em `.`, instalar `@supabase/supabase-js @supabase/ssr zod recharts`, `vitest`, `@vitest/coverage-v8`, `@playwright/test`, e inicializar shadcn/ui. Confirmar na documentação (Context7) o nome do arquivo de proteção de rotas da versão instalada (`middleware.ts` ou `proxy.ts`).
- [ ] **Step 2: Escrever o teste que falha** em `tests/unit/env.test.ts`: `getEnv({})` lança erro contendo `NEXT_PUBLIC_SUPABASE_URL`; `getEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })` devolve `{ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "k" }`.
- [ ] **Step 3:** Rodar `npx vitest run tests/unit/env.test.ts`. Esperado: FAIL (`getEnv` não existe).
- [ ] **Step 4:** Implementar `getEnv` em `src/lib/env.ts` com Zod.
- [ ] **Step 5:** Rodar o teste. Esperado: PASS.
- [ ] **Step 6:** Criar `src/styles/tema.css` com os tokens de cor do tema escuro (fundo quase preto, destaque azul-violeta) e aplicar Inter no layout raiz. Criar `.env.example` sem valores reais e garantir `.env*` (exceto `.env.example`) no `.gitignore`.
- [ ] **Step 7: Commit** — `chore: scaffold nextjs, test tooling and env validation`

---

### Task 2: Schema, RLS e teste de isolamento

**Files:**
- Create: `supabase/migrations/0001_schema_rls.sql`, `tests/integration/rls.test.ts`, `tests/integration/helpers.ts`

**Interfaces:**
- Produces (SQL): tabelas `empresas`, `perfis`, `clientes` conforme seção 5 da spec; função `public.empresa_id_atual() returns uuid`.
- Produces (helpers): `criarEmpresaComUsuario(nomeEmpresa: string, email: string, senha: string): Promise<{ empresaId: string; clienteSupabase: SupabaseClient }>` — usa a chave de serviço para criar empresa, usuário e perfil, e devolve um cliente já autenticado como esse usuário.

- [ ] **Step 1:** Subir o Supabase local (`supabase start`) ou usar um projeto de desenvolvimento. Os testes de integração leem `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` do ambiente de teste, nunca de código.
- [ ] **Step 2: Escrever os testes que falham** em `rls.test.ts`, com duas empresas A e B, cada uma com um usuário e um cliente:
  - usuário A lista `clientes` e vê só os da empresa A (0 linhas da B);
  - usuário A tenta `update` e `delete` num cliente da B: 0 linhas afetadas, e o cliente da B continua intacto;
  - usuário A tenta `insert` com `empresa_id` da B: erro de política;
  - `insert` sem `empresa_id` grava automaticamente o da empresa A;
  - usuário A lê `empresas` e vê só a própria; lê `perfis` e vê só o próprio.
- [ ] **Step 3:** Rodar `npx vitest run tests/integration/rls.test.ts`. Esperado: FAIL (tabelas inexistentes).
- [ ] **Step 4:** Escrever a migration. Pontos que a spec não determina: `empresa_id_atual()` deve ser `security definer`, `stable` e com `search_path` fixo, para evitar recursão infinita da política de `perfis`; `clientes.empresa_id` tem `default public.empresa_id_atual()`; `status` e `papel` com `check`; `valor_estimado numeric(12,2) not null default 0 check (valor_estimado >= 0)`; `atualizado_em` mantido por trigger; RLS ativado nas três tabelas; índice em `clientes (empresa_id, status)` e `clientes (empresa_id, criado_em)`.
- [ ] **Step 5:** Aplicar a migration e rodar os testes. Esperado: PASS.
- [ ] **Step 6: Commit** — `feat: add schema with row level security and isolation tests`

---

### Task 3: Login, sessão e proteção de rotas

**Files:**
- Create: `src/lib/supabase/{server,browser,session}.ts`, `proxy.ts` (ou `middleware.ts`), `src/app/login/{page.tsx,actions.ts}`, `src/lib/login-schema.ts`
- Test: `tests/unit/login-schema.test.ts`, `tests/integration/sessao.test.ts`

**Interfaces:**
- Consumes: `getEnv` (Task 1); tabelas e `criarEmpresaComUsuario` (Task 2).
- Produces: `loginSchema` (Zod: `email` normalizado com trim e minúsculas, `senha` não vazia); `entrar(prev: EstadoLogin, form: FormData): Promise<EstadoLogin>` onde `EstadoLogin = { erro?: string }`; `obterSessao(): Promise<{ usuarioId: string; empresaId: string; papel: "admin" | "membro" } | null>` em `session.ts`; `createServerClient()` e `createBrowserClient()` em `server.ts`/`browser.ts`.

- [ ] **Step 1: Escrever os testes que falham:**
  - `loginSchema` normaliza `"  ANA@Exemplo.com "` para `"ana@exemplo.com"` e rejeita e-mail inválido e senha vazia;
  - integração: `obterSessao` devolve `null` sem sessão; devolve `empresaId` correto com sessão válida; **para usuário autenticado sem linha em `perfis`, devolve `null`** (Review Focus 1);
  - integração: `entrar` com senha errada devolve `{ erro: "E-mail ou senha incorretos" }`, e o mesmo texto para e-mail inexistente.
- [ ] **Step 2:** Rodar os testes. Esperado: FAIL.
- [ ] **Step 3:** Implementar `loginSchema`, os clientes Supabase com `@supabase/ssr` e `obterSessao`, que consulta `perfis` para obter `empresaId` e `papel`.
- [ ] **Step 4:** Implementar `entrar` como server action: valida com `loginSchema`, chama `signInWithPassword`, redireciona para `/dashboard` em caso de sucesso. Qualquer falha de autenticação devolve a mensagem fixa. Se houver sessão mas `obterSessao` for `null`, faz `signOut` e devolve `{ erro: "Sua conta não está vinculada a uma empresa" }`.
- [ ] **Step 5:** Implementar a proteção de rotas: sem sessão em qualquer rota exceto `/login`, redireciona para `/login`; com sessão em `/login`, redireciona para `/dashboard`; `/` redireciona conforme a sessão. Sessão expirada cai no mesmo caminho.
- [ ] **Step 6:** Construir `/login` com o tema escuro: e-mail, senha, botão, mensagem de erro. Sem link de cadastro.
- [ ] **Step 7:** Rodar os testes. Esperado: PASS.
- [ ] **Step 8: Commit** — `feat: add login, session lookup and route protection`

---

### Task 4: Clientes — schema de validação e repositório

**Files:**
- Create: `src/lib/clientes/{schema,busca,repositorio}.ts`
- Test: `tests/unit/clientes-schema.test.ts`, `tests/unit/busca.test.ts`, `tests/integration/repositorio.test.ts`

**Interfaces:**
- Consumes: `createServerClient` (Task 3), tabelas (Task 2).
- Produces:
  - `type Status = "lead" | "cliente" | "perdido"`
  - `clienteSchema` (Zod): `nome` obrigatório; `email` opcional e válido; `telefone`, `empresa_contato`, `notas` opcionais; `status: Status`; `valor_estimado` número ≥ 0 com no máximo 2 casas, vazio vira 0
  - `type ClienteInput = z.infer<typeof clienteSchema>` e `type Cliente = ClienteInput & { id: string; empresa_id: string; criado_em: string; atualizado_em: string }`
  - `escaparTermoBusca(termo: string): string` em `busca.ts` (Task 5 usa)
  - `type ListaClientes = { itens: Cliente[]; total: number; pagina: number; totalPaginas: number }`
  - O acesso ao banco é injetado (decisão do controlador, para testar fora do Next): `listarClientes(db: SupabaseClient, params: { busca?: string; status?: Status; pagina?: number }): Promise<ListaClientes>`
  - `criarCliente(db: SupabaseClient, input: ClienteInput): Promise<Cliente>`, `atualizarCliente(db: SupabaseClient, id: string, input: ClienteInput): Promise<Cliente>`, `excluirCliente(db: SupabaseClient, id: string): Promise<void>`. As páginas e actions passam `await createServerClient()`.
  - Colunas de controle (`id`, `empresa_id`, `criado_em`, `atualizado_em`) nunca fazem parte de `ClienteInput` nem são enviadas em insert/update; os campos `text` têm limite de tamanho no schema (`nome` até 200, `email` até 254, `telefone` até 40, `empresa_contato` até 200, `notas` até 5000).
  - Constante exportada `TAMANHO_PAGINA = 20`

- [ ] **Step 1: Escrever os testes que falham:**
  - `clienteSchema`: nome vazio rejeitado; `valor_estimado` `""` vira `0`; `-5` rejeitado; `10.999` rejeitado; `10.5` aceito (Review Focus 5);
  - `escaparTermoBusca("a%b_c,d(e)")` devolve um texto em que `%`, `_`, `,`, `(`, `)` não têm efeito especial no filtro (Review Focus 2);
  - integração: criar 25 clientes → `listarClientes({})` devolve 20 itens, `total` 25, `totalPaginas` 2; `pagina: 2` devolve 5; **`pagina: 999` devolve a última página; `pagina: NaN` e `0` devolvem a primeira** (Review Focus 3); busca por parte do nome ou do e-mail encontra o cliente, sem diferenciar maiúsculas de minúsculas (`ilike`); filtro por `status` funciona; busca com `%` ou `_` não retorna todos os registros; busca com vírgula, parênteses e aspas no termo é tratada como texto e não quebra o filtro `or(...)` do PostgREST (escapar entre aspas ou equivalente, e ter um teste de integração para cada um desses caracteres); `nome` acima de 200 caracteres é rejeitado pelo schema.
- [ ] **Step 2:** Rodar os testes. Esperado: FAIL.
- [ ] **Step 3:** Implementar `clienteSchema` e `escaparTermoBusca`.
- [ ] **Step 4:** Implementar o repositório com o cliente Supabase do usuário (nunca a chave de serviço), usando `range` para paginar e `count: "exact"`. Ordenar por `criado_em` decrescente. Não enviar `empresa_id`: o `default` da Task 2 preenche.
- [ ] **Step 5:** Rodar os testes. Esperado: PASS.
- [ ] **Step 6: Commit** — `feat: add cliente validation and repository`

---

### Task 5: Casca do app e tela de clientes

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/clientes/{page.tsx,actions.ts}`, `src/components/clientes/{tabela,painel-form,botao-excluir}.tsx`, `src/components/menu-lateral.tsx`
- Test: `tests/unit/clientes-actions.test.ts`

**Interfaces:**
- Consumes: `obterSessao` (Task 3); `clienteSchema`, `listarClientes`, `criarCliente`, `atualizarCliente`, `excluirCliente` (Task 4).
- Produces: server actions `salvarCliente(prev: EstadoForm, form: FormData): Promise<EstadoForm>` e `removerCliente(id: string): Promise<void>`, com `EstadoForm = { ok?: true; erros?: Record<string, string> }`; layout `(app)` que exige sessão, mostra menu lateral (Dashboard, Clientes) e botão Sair.

- [ ] **Step 1: Escrever os testes que falham** para `salvarCliente` (com o repositório simulado): dados inválidos devolvem `erros` por campo e não chamam o repositório; dados válidos sem `id` chamam `criarCliente`; com `id` chamam `atualizarCliente`; falha do repositório devolve erro amigável genérico e registra o detalhe no log do servidor; `removerCliente` com falha do repositório devolve erro amigável (não lança para o usuário) e registra o detalhe; a página `/clientes` mostra mensagem amigável quando `listarClientes` falha (spec §9), com teste; a action de Sair chama `signOut` e redireciona para `/login`, com teste unitário.
- [ ] **Step 2:** Rodar `npx vitest run tests/unit/clientes-actions.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar as server actions, validando de novo com `clienteSchema` no servidor.
- [ ] **Step 4:** Construir o layout `(app)` com menu lateral responsivo (vira menu recolhido no celular) e botão Sair, que encerra a sessão e volta ao login.
- [ ] **Step 5:** Construir `/clientes`: tabela com busca e filtro por status (via parâmetros de URL), paginação, painel lateral para criar e editar, exclusão com confirmação. Estado vazio com botão "Adicionar primeiro cliente". Parâmetros de URL inválidos são ignorados, nunca geram erro.
- [ ] **Step 6:** Rodar os testes. Esperado: PASS. Conferir no navegador (`npm run dev`) o fluxo criar, editar, buscar, excluir.
- [ ] **Step 7: Commit** — `feat: add app shell and clientes screen`

---

### Task 6: Indicadores e dashboard

**Files:**
- Create: `supabase/migrations/0003_indicadores_empresa.sql`, `src/lib/indicadores.ts`, `src/app/(app)/dashboard/page.tsx`, `src/components/dashboard/{cartoes,grafico-semanas,grafico-status}.tsx`
- Test: `tests/unit/indicadores.test.ts`, `tests/integration/indicadores.test.ts`

**Interfaces:**
- Consumes: `Status` (Task 4); `obterSessao(db)` e `createServerClient` (Task 3); helpers de integração (Task 2/3b).
- Produces:
  - SQL: função `public.indicadores_empresa(p_agora timestamptz default now()) returns jsonb`, `language sql stable`, **`security invoker`** (a RLS de `clientes` continua valendo, então só agrega a empresa do usuário), `set search_path = ''`, `execute` concedido só a `authenticated` (revogado de `public` e `anon`). Devolve `{ contagens: { lead, cliente, perdido }, valor_em_negociacao, leads_por_semana: [{ semana_inicio, total }] }`, com agregação feita no banco: nada de buscar todas as linhas pela API (o PostgREST trunca em 1000 linhas, spec §6). `leads_por_semana` traz só as semanas que têm clientes criados nas últimas 8 semanas (segunda-feira UTC), em `date`.
  - `type Indicadores = { totalLeads: number; totalClientes: number; taxaConversao: number; valorEmNegociacao: number; leadsPorSemana: { semanaInicio: string; total: number }[]; porStatus: Record<Status, number> }`
  - `type IndicadoresBrutos` = o `jsonb` acima já tipado; `montarIndicadores(bruto: IndicadoresBrutos, agora: Date): Indicadores` (função pura); `buscarIndicadores(db: SupabaseClient, agora?: Date): Promise<Indicadores>` (chama `db.rpc("indicadores_empresa", ...)` e `montarIndicadores`; erro do banco vira exceção com log, nunca zeros silenciosos); `formatarPercentual(fracao: number): string` (`0.25` → `"25%"`, `0` → `"0%"`, arredonda para inteiro, formato pt-BR).
  - Decisões que a spec fixa ou deixa abertas: `taxaConversao` é uma fração de 0 a 1, igual a clientes ÷ (leads + clientes), e `0` se o denominador for 0; `perdido` não entra na taxa nem no valor; `valorEmNegociacao` soma só `status = lead`; semanas começam na segunda-feira em UTC; `leadsPorSemana` sempre devolve exatamente 8 itens, do mais antigo ao mais recente, com `0` nas semanas sem clientes novos; conta como "novo lead" todo cliente criado na semana, independente do status atual. O controlador aplica a migration `0003` no projeto Supabase de desenvolvimento (o subagente só escreve o arquivo).

- [ ] **Step 1: Escrever os testes que falham:**
  - unitários de `montarIndicadores` (bruto simulado): bruto vazio: tudo `0`, 8 semanas com `total: 0`, `taxaConversao: 0` (Review Focus 4); só `perdido`: `taxaConversao: 0` e `valorEmNegociacao: 0`; contagens lead 3, cliente 1, perdido 1 e valor 350: `totalLeads: 3`, `totalClientes: 1`, `taxaConversao: 0.25`, `valorEmNegociacao: 350`; semanas preenchidas com `0` e ordenadas, 8 itens, segunda-feira como início; `formatarPercentual(0.25)` é `"25%"`;
  - integração (`tests/integration/indicadores.test.ts`, com duas empresas): mais de 1000 clientes inseridos para a empresa A pelo cliente de serviço em lotes (por exemplo 1050, entre `lead`, `cliente` e `perdido` em proporções conhecidas): `buscarIndicadores` reporta totais exatos, sem truncar em 1000; os dados da empresa B não entram na conta de A; `perdido` fora do valor e da taxa; clientes criados num domingo 23:59 UTC e numa segunda 00:00 UTC caem em semanas diferentes; um cliente criado há mais de 8 semanas entra nos totais mas não em `leadsPorSemana`; o cliente anônimo não consegue executar a função.
- [ ] **Step 2:** Rodar os testes. Esperado: FAIL (função SQL e módulo inexistentes).
- [ ] **Step 3:** Escrever a migration `0003` e implementar `montarIndicadores`, `buscarIndicadores` e `formatarPercentual`. Parar e avisar o controlador para aplicar a migration antes dos testes de integração.
- [ ] **Step 4:** Construir `/dashboard`: chama `obterSessao` e `buscarIndicadores` dentro de `Suspense` (a página lê cookies, com `cacheComponents`), renderiza quatro cartões (a taxa com `formatarPercentual`), gráfico de barras de leads por semana e rosca por status (Recharts, cores do tema). Sem clientes: estado vazio com o botão "Adicionar primeiro cliente", sem gráficos. `obterSessao` lança exceção quando a consulta de `perfis` falha: a página trata com mensagem amigável.
- [ ] **Step 5:** Rodar os testes. Esperado: PASS.
- [ ] **Step 6: Commit** — `feat: add metrics aggregation and dashboard`

---

### Task 7: Testes E2E e verificação final

**Files:**
- Create: `tests/e2e/{login,clientes}.spec.ts`, `tests/e2e/setup.ts`

**Interfaces:**
- Consumes: `criarEmpresaComUsuario` (Task 2) para preparar o usuário de teste antes da execução.

- [ ] **Step 1: Escrever os testes E2E** (Playwright):
  - acessar `/dashboard` sem sessão redireciona para `/login`;
  - login com senha errada mostra `E-mail ou senha incorretos` e permanece em `/login`;
  - login válido leva ao `/dashboard` com estado vazio;
  - criar um cliente com status `lead` e valor `1500` o mostra em `/clientes`, e o cartão "Total de leads" do dashboard passa a `1` e "Valor em negociação" a `R$ 1.500,00`;
  - Sair encerra a sessão e `/dashboard` volta a redirecionar.
- [ ] **Step 1b: Fechar pendências de reforço registradas nas revisões** (antes dos E2E):
  - completar a simetria dos testes de isolamento em `tests/integration/rls.test.ts` com um bloco `it.each` sobre as duas empresas `[a, b]`: inserir com `empresa_id` alheio, mover o próprio cliente para a outra empresa, ler cliente pelo `id` do outro, ler `perfis` e `empresas` da outra empresa; e provar que o anônimo não executa `empresa_id_atual()` via RPC;
  - no proxy (`src/lib/proxy/processar-requisicao.ts`, `src/lib/supabase/session.ts`): erros 4xx do Auth (JWT de usuário apagado, refresh token inválido) devem limpar a sessão com `signOut({ scope: "local" })` e redirecionar para `/login`; só 5xx e falhas de rede seguem o caminho de falha fechada sem limpar; o mesmo erro não é registrado duas vezes; testes unitários para cada ramo, incluindo `getUser` lançando erro que não seja "session missing" e sessão válida em `/login` indo para `/dashboard`;
  - `vitest.config.ts`: ampliar `coverage.include` para `src/**` (excluindo `src/components/ui/**` gerado pelo shadcn e arquivos de configuração) e definir `thresholds` de 80% para linhas, funções e ramos, para o número da spec medir o app e não só `src/lib`;
  - registrar em `.env.example` a variável `TEST_SUPABASE_PROJECT_REF` (valor vazio) e, em `README.md`, que a trava compara a URL com a variável e só evita erro acidental: o projeto de testes deve ser um projeto Supabase de desenvolvimento dedicado, nunca o de produção.
- [ ] **Step 2:** Rodar `npx playwright test`. Esperado: PASS.
- [ ] **Step 3:** Rodar `npx vitest run --coverage`. Esperado: cobertura ≥ 80% (agora medida sobre `src/**`).
- [ ] **Step 4:** Rodar `npm run build` e `npm run lint`. Esperado: sem erros.
- [ ] **Step 5:** Revisão de segurança: confirmar que a chave de serviço aparece só em `tests/` e que nenhum arquivo em `src/` a importa.
- [ ] **Step 6:** Configurar o projeto na Vercel com as duas variáveis públicas do Supabase e confirmar o login em produção com um usuário criado pelo painel do Supabase.
- [ ] **Step 7: Commit** — `test: add e2e coverage for login and clientes flows`
