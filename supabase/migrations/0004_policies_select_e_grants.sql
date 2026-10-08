-- Endurecimento pos-revisao final:
-- (a) policies chamam (select public.empresa_id_atual()): o planner avalia a funcao uma vez
--     por consulta (initPlan) em vez de uma vez por linha; semantica identica;
-- (b) anon nao precisa de nenhum privilegio nas tabelas (a RLS ja negava, agora nem o GRANT);
-- (c) authenticated nao precisa de TRUNCATE (que ignora a RLS).

drop policy if exists empresas_select_propria on public.empresas;
create policy empresas_select_propria on public.empresas
  for select to authenticated
  using (id = (select public.empresa_id_atual()));

drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes
  for select to authenticated
  using (empresa_id = (select public.empresa_id_atual()));

drop policy if exists clientes_insert on public.clientes;
create policy clientes_insert on public.clientes
  for insert to authenticated
  with check (empresa_id = (select public.empresa_id_atual()));

drop policy if exists clientes_update on public.clientes;
create policy clientes_update on public.clientes
  for update to authenticated
  using (empresa_id = (select public.empresa_id_atual()))
  with check (empresa_id = (select public.empresa_id_atual()));

drop policy if exists clientes_delete on public.clientes;
create policy clientes_delete on public.clientes
  for delete to authenticated
  using (empresa_id = (select public.empresa_id_atual()));

revoke all on public.empresas, public.perfis, public.clientes from anon;
revoke truncate on public.empresas, public.perfis, public.clientes from authenticated;
