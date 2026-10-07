# CRM SaaS: Login e Dashboard (v1) — Design

Data: 2026-10-06
Status: aprovada (esclarecimentos incorporados em 2026-10-07 após revisão do code-reviewer)

## 1. Objetivo

Um SaaS multi-empresa em que cada empresa cliente entra com e-mail e senha e acessa um dashboard de CRM com os seus próprios clientes e leads. Os dados de uma empresa nunca são visíveis para outra.

**Critérios de sucesso**
- Um usuário válido consegue entrar, ver indicadores reais e gerenciar clientes e leads.
- Um usuário da empresa A não consegue ler nem alterar dados da empresa B, comprovado por teste automatizado.
- Visual moderno e tecnológico, utilizável no celular.

## 2. Decisões tomadas

| Tema | Decisão |
|---|---|
| Público | SaaS vendido a várias empresas (multi-tenant) |
| Entrada de novas empresas | Somente por convite do dono do sistema. Sem cadastro aberto na v1 |
| Escopo da v1 | Casca do dashboard, CRUD de clientes e leads, indicadores com dados reais |
| Stack | Next.js (App Router, TypeScript) + Supabase (Auth e Postgres) + Vercel |
| Interface | Tailwind CSS + shadcn/ui, tema escuro |

## 3. Fora do escopo da v1

Cadastro aberto, recuperação de senha por e-mail, tela para criar empresas e usuários, funil kanban, tarefas e follow-ups, permissões finas entre `admin` e `membro`. Nenhum desses itens exige refazer a base.

## 4. Arquitetura

- Um app Next.js hospedado na Vercel.
- Supabase Auth para login com e-mail e senha.
- Supabase Postgres para os dados, com RLS ativado em todas as tabelas.
- A proteção de rotas é feita no servidor, antes de a página carregar, no arquivo `proxy.ts` (nome do antigo middleware a partir do Next.js 16). A sessão é verificada com `supabase.auth.getUser()`, nunca só pelo cookie.
- As variáveis de ambiente obrigatórias são verificadas na inicialização do app.
- As chaves do Supabase ficam em variáveis de ambiente. A chave de serviço nunca vai para o navegador.

### Telas

- `/login`: e-mail e senha.
- `/dashboard`: indicadores.
- `/clientes`: lista, criação, edição e exclusão.
- Menu lateral com botão de sair.
- Qualquer rota protegida sem sessão redireciona para `/login`. Sessão expirada também.

## 5. Modelo de dados

**`empresas`**
- `id`, `nome`, `criada_em`. O nome `criada_em` (feminino, concordando com "empresa") é intencional e deve ser mantido; as demais tabelas usam `criado_em`.

**`perfis`**
- `usuario_id` (referência ao usuário do Supabase Auth), `empresa_id`, `papel` (`admin` ou `membro`), `criado_em`.
- Cada usuário pertence a exatamente uma empresa (`usuario_id` é a chave primária).

**`clientes`**
- `id`, `empresa_id`, `nome`, `email`, `telefone`, `empresa_contato`, `status` (`lead`, `cliente` ou `perdido`), `valor_estimado`, `notas`, `criado_em`, `atualizado_em`.

### Isolamento (RLS)

Em `clientes`, a política permite ler e alterar apenas linhas cujo `empresa_id` seja o da empresa do usuário autenticado, obtida a partir de `perfis`. Inserções também devem gravar o `empresa_id` do próprio usuário. O isolamento vale no banco, independente do código da aplicação.

Em `perfis`, cada usuário lê apenas a própria linha (decisão da v1: nada na v1 lista colegas de empresa). Em `empresas`, cada usuário lê apenas a empresa à qual pertence. `perfis` e `empresas` são somente leitura pela API: criação e alteração só pelo dono do sistema, com a chave de serviço, fora do app. O usuário anônimo (sem login) não lê nem escreve em nenhuma das três tabelas.

O critério de isolamento é comprovado por testes automatizados que cobrem: leitura e escrita cruzadas nos dois sentidos (A contra B e B contra A), tentativas de escrita em `perfis` e `empresas`, usuário anônimo e usuário autenticado sem perfil. Os testes rodam contra um projeto Supabase de desenvolvimento, nunca contra um projeto real de produção.

### Usuário válido

Um usuário válido tem login no Supabase Auth **e** uma linha em `perfis`. Quem tem login mas não tem perfil é desconectado e vê a mensagem "Sua conta não está vinculada a uma empresa".

### Criação de acessos

O dono do sistema cria a empresa, o usuário e o perfil diretamente pelo painel do Supabase. A v1 não tem tela para isso.

## 6. Dashboard

Os indicadores são calculados a partir da tabela `clientes`, sempre sobre todos os clientes da empresa, sem truncar. O cálculo não pode depender de buscar todas as linhas pela API, pois o PostgREST limita a resposta a 1000 linhas por padrão; com volumes maiores a agregação é feita no banco.

**Cartões**
- Total de leads.
- Total de clientes.
- Taxa de conversão: clientes ÷ (leads + clientes), exibida em porcentagem. Clientes `perdido` não entram na conta.
- Valor em negociação: soma de `valor_estimado` dos leads ativos. "Lead ativo" é todo cliente com `status = lead`.

**Gráficos**
- Novos leads por semana, nas últimas 8 semanas.
- Distribuição por status, em rosca.

**Estado vazio:** sem clientes, a tela mostra uma mensagem e o botão "Adicionar primeiro cliente", sem gráficos vazios ou quebrados.

## 7. Clientes e leads

- Tabela com busca por nome ou e-mail (parcial, sem diferenciar maiúsculas de minúsculas, tratando `%`, `_`, vírgula e parênteses como texto) e filtro por status. Os leads são gerenciados nesta mesma tela, pelo filtro de status.
- Formulário em painel lateral para criar e editar.
- Exclusão com confirmação.
- Paginação de 20 registros por página.

## 8. Visual

- Tema escuro: fundo quase preto, destaque em azul-violeta, cantos arredondados, leve brilho nos cartões.
- Fonte Inter, transições suaves, layout responsivo.
- Cores centralizadas em um único arquivo de tema, para trocar caso exista identidade visual.

## 9. Erros e segurança

- Falha de login mostra mensagem genérica ("e-mail ou senha incorretos"), sem revelar qual campo errou.
- Entradas dos formulários são validadas no servidor com schema (Zod).
- Falhas de rede ou banco mostram mensagem amigável. O detalhe técnico fica só no log do servidor.
- Nenhum segredo no código. Variáveis obrigatórias são verificadas na inicialização.

## 10. Testes

- **Unitários:** cálculo dos indicadores e validação dos formulários.
- **Integração:** regras de RLS, provando que um usuário da empresa A não lê nem altera dados da empresa B.
- **E2E (Playwright):** login com sucesso e com falha, redirecionamento sem sessão, criar um cliente e vê-lo na lista e nos indicadores.
- Cobertura mínima: 80%.
- O desenvolvimento segue TDD: teste primeiro.
