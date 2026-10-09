-- Troca de senha obrigatoria no primeiro acesso.
-- Usuarios novos sao criados com perfis.precisa_trocar_senha = true e uma senha temporaria;
-- o app os leva a /definir-senha ate concluirem a troca. Quem ja existe fica com false.

alter table public.perfis
  add column precisa_trocar_senha boolean not null default false;

-- authenticated nao tem UPDATE em perfis (so SELECT), entao o flag so e desligado por esta
-- funcao, e apenas no proprio perfil (auth.uid()). security definer + search_path fixo.
create function public.concluir_troca_senha()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.perfis
  set precisa_trocar_senha = false
  where usuario_id = (select auth.uid())
$$;

revoke all on function public.concluir_troca_senha() from public, anon;
grant execute on function public.concluir_troca_senha() to authenticated, service_role;
