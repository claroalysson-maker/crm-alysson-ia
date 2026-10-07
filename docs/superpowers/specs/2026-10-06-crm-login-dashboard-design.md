# CRM SaaS: Login e Dashboard (v1) — Design

Data: 2026-10-06
Status: aguardando revisão

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
- A proteção de rotas é feita no servidor (middleware), antes de a página carregar.
- As chaves do Supabase ficam em variáveis de ambiente. A chave de serviço nunca vai para o navegador.

### Telas

- `/login`: e-mail e senha.
- `/dashboard`: indicadores.
- `/clientes`: lista, criação, edição e exclusão.
- Menu lateral com botão de sair.
- Qualquer rota protegida sem sessão redireciona para `/login`. Sessão expirada também.

## 5. Modelo de dados

**`empresas`**
- `id`, `nome`, `criada_em`.

**`perfis`**
- `usuario_id` (referência ao usuário do Supabase Auth), `empresa_id`, `papel` (`admin` ou `membro`).

**`clientes`**
- `id`, `empresa_id`, `nome`, `email`, `telefone`, `empresa_contato`, `status` (`lead`, `cliente` ou `perdido`), `valor_estimado`, `notas`, `criado_em`, `atualizado_em`.

### Isolamento (RLS)

Em `clientes` e `perfis`, a política permite ler e alterar apenas linhas cujo `empresa_id` seja o da empresa do usuário autenticado, obtida a partir de `perfis`. Inserções também devem gravar o `empresa_id` do próprio usuário. O isolamento vale no banco, independente do código da aplicação.

### Criação de acessos

O dono do sistema cria a empresa, o usuário e o perfil diretamente pelo painel do Supabase. A v1 não tem tela para isso.

## 6. Dashboard

Os indicadores são calculados a partir da tabela `clientes`.

**Cartões**
- Total de leads.
- Total de clientes.
- Taxa de conversão: clientes ÷ (leads + clientes).
- Valor em negociação: soma de `valor_estimado` dos leads ativos.

**Gráficos**
- Novos leads por semana, nas últimas 8 semanas.
- Distribuição por status, em rosca.

**Estado vazio:** sem clientes, a tela mostra uma mensagem e o botão "Adicionar primeiro cliente", sem gráficos vazios ou quebrados.

## 7. Clientes e leads

- Tabela com busca por nome ou e-mail e filtro por status.
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
