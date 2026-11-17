-- Appoteca · scorte giorno per giorno in tutti i piani (rilascio 1 della feature «categorie»).
-- La modalità «portapillole settimanale» sparisce: la scorta scende ogni giorno per ogni piano,
-- e il portapillole resta solo come promemoria (plans.prep_reminder).
-- Prima di applicarla: pg_dump del database di produzione, deploy fuori dagli orari dei cron.
-- Nessun begin/commit esplicito: la CLI di Supabase applica ogni file di migrazione in una transazione.

-- 1. RPC della modalità settimanale
drop function public.apply_prep(uuid, date, date, jsonb);
drop function public.undo_prep(uuid, date);
drop function public.change_stock_mode(uuid, text, date, jsonb);

-- 2. Nei piani settimanali la scorta salvata è quella in casa: le dosi del portapillole già preparato
--    sono già state scalate. La scorta comincia a scendere ogni giorno solo da X, il primo
--    prep_weekday dopo l'ultima settimana preparata nel periodo settimanale in corso (o, senza
--    preparazioni, il primo prep_weekday da mode_since in poi). È la regola di nextPrepDue.
--    I flaconi (reorder_days) non si spostano: il loro stock_as_of conta il promemoria di riordino.
with last_run as (
  select r.plan_id, max(r.week_start) as week_start
  from public.prep_runs r
  join public.plans p on p.id = r.plan_id
  where r.undone_at is null
    and r.week_start + 6 >= p.mode_since
  group by r.plan_id
),
weekly_start as (
  select p.id as plan_id,
         b.base + ((p.prep_weekday - extract(isodow from b.base)::int + 7) % 7) as x
  from public.plans p
  left join last_run l on l.plan_id = p.id
  cross join lateral (select coalesce(l.week_start + 1, p.mode_since) as base) b
  where p.stock_mode = 'weekly'
)
update public.medications m
set stock_as_of = greatest(m.stock_as_of, w.x)
from weekly_start w
where m.plan_id = w.plan_id and m.reorder_days is null;

-- 3. Il promemoria del portapillole resta solo a chi lo usava; i piani nuovi partono senza
update public.plans set prep_reminder = (prep_reminder and stock_mode = 'weekly');
alter table public.plans alter column prep_reminder set default false;

-- 4. Preparazioni (con RLS e indici)
drop table public.prep_runs;

-- 5. Colonne della modalità. Il check di stock_events.type resta: 'prep' e 'prep_undo' restano nello storico.
alter table public.plans drop column stock_mode, drop column mode_since;
