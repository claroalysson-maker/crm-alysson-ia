-- Schema multi-tenant do CRM: empresas, perfis, clientes, com RLS por empresa.

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

create table public.perfis (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  papel text not null default 'membro' check (papel in ('admin', 'membro')),
  criado_em timestamptz not null default now()
);

create index perfis_empresa_id_idx on public.perfis (empresa_id);

-- security definer + search_path fixo: le perfis sem disparar a RLS de perfis
-- (evita recursao infinita nas politicas).
create function public.empresa_id_atual()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.empresa_id from public.perfis p where p.usuario_id = (select auth.uid())
$$;

revoke all on function public.empresa_id_atual() from public, anon;
grant execute on function public.empresa_id_atual() to authenticated, service_role;

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.empresa_id_atual()
    references public.empresas (id) on delete cascade,
  nome text not null,
  email text,
  telefone text,
  empresa_contato text,
  status text not null default 'lead' check (status in ('lead', 'cliente', 'perdido')),
  valor_estimado numeric(12, 2) not null default 0 check (valor_estimado >= 0),
  notas text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index clientes_empresa_status_idx on public.clientes (empresa_id, status);
create index clientes_empresa_criado_em_idx on public.clientes (empresa_id, criado_em);

create function public.definir_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger clientes_atualizado_em
  before update on public.clientes
  for each row execute function public.definir_atualizado_em();

alter table public.empresas enable row level security;
alter table public.perfis enable row level security;
alter table public.clientes enable row level security;

create policy empresas_select_propria on public.empresas
  for select to authenticated
  using (id = public.empresa_id_atual());

create policy perfis_select_proprio on public.perfis
  for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy clientes_select on public.clientes
  for select to authenticated
  using (empresa_id = public.empresa_id_atual());

create policy clientes_insert on public.clientes
  for insert to authenticated
  with check (empresa_id = public.empresa_id_atual());

create policy clientes_update on public.clientes
  for update to authenticated
  using (empresa_id = public.empresa_id_atual())
  with check (empresa_id = public.empresa_id_atual());

create policy clientes_delete on public.clientes
  for delete to authenticated
  using (empresa_id = public.empresa_id_atual());
