-- Indicadores do dashboard, agregados no banco (o PostgREST trunca em 1000 linhas).
-- security invoker: a RLS de clientes continua valendo e so a empresa do usuario e agregada.
-- Semanas comecam na segunda-feira em UTC; leads_por_semana traz so as semanas com
-- clientes criados nas ultimas 8 semanas (a semana atual inclusive).

create function public.indicadores_empresa(p_agora timestamptz default now())
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'contagens', jsonb_build_object(
      'lead', count(*) filter (where c.status = 'lead'),
      'cliente', count(*) filter (where c.status = 'cliente'),
      'perdido', count(*) filter (where c.status = 'perdido')
    ),
    'valor_em_negociacao',
      coalesce(sum(c.valor_estimado) filter (where c.status = 'lead'), 0),
    'leads_por_semana', coalesce((
      select jsonb_agg(
        jsonb_build_object('semana_inicio', to_char(s.semana, 'YYYY-MM-DD'), 'total', s.total)
        order by s.semana
      )
      from (
        select date_trunc('week', w.criado_em at time zone 'utc')::date as semana,
               count(*) as total
        from public.clientes w
        where (w.criado_em at time zone 'utc')
              >= date_trunc('week', p_agora at time zone 'utc') - interval '7 weeks'
          and (w.criado_em at time zone 'utc')
              < date_trunc('week', p_agora at time zone 'utc') + interval '1 week'
        group by 1
      ) s
    ), '[]'::jsonb)
  )
  from public.clientes c
$$;

revoke all on function public.indicadores_empresa(timestamptz) from public, anon;
grant execute on function public.indicadores_empresa(timestamptz) to authenticated;
