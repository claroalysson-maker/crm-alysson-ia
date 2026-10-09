-- Troca de senha obrigatoria no primeiro acesso.
-- Usuarios novos sao criados com perfis.precisa_trocar_senha = true e uma senha temporaria;
-- o app os leva a /definir-senha ate concluirem a troca. Quem ja existe fica com false.

alter table public.perfis
  add column precisa_trocar_senha boolean not null default false;

-- authenticated so le perfis (SELECT): escrita direta e revogada aqui, alem de nao haver policy
-- de escrita na RLS. O flag so e desligado por esta funcao, apenas no proprio perfil
-- (auth.uid()). security definer + search_path fixo.
revoke insert, update, delete on public.perfis from authenticated;

create or replace function public.concluir_troca_senha()
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
