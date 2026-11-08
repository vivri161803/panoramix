-- Panoramix · Row Level Security
-- Ogni riga è raggiungibile solo dal proprietario del piano.
-- Il controllo giornaliero usa la service role (che ignora RLS) solo lato server.

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.plan_recipients enable row level security;
alter table public.medications enable row level security;
alter table public.stock_events enable row level security;
alter table public.prep_runs enable row level security;
alter table public.alert_log enable row level security;
alter table public.alert_runs enable row level security;
alter table public.cron_runs enable row level security;

-- Il piano appartiene all'utente collegato?
create or replace function public.owns_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plans p
    where p.id = p_plan_id and p.owner_id = (select auth.uid())
  )
$$;

create or replace function public.owns_medication(p_medication_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.medications m
    join public.plans p on p.id = m.plan_id
    where m.id = p_medication_id and p.owner_id = (select auth.uid())
  )
$$;

revoke all on function public.owns_plan(uuid) from public, anon;
revoke all on function public.owns_medication(uuid) from public, anon;
grant execute on function public.owns_plan(uuid) to authenticated;
grant execute on function public.owns_medication(uuid) to authenticated;

-- profiles: solo il proprio
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- l'email arriva da Auth, il gestore può cambiare solo nome e cognome
revoke update on public.profiles from authenticated;
grant update (first_name, last_name) on public.profiles to authenticated;

-- plans
create policy plans_all_own on public.plans
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- figli del piano
create policy plan_recipients_all_own on public.plan_recipients
  for all to authenticated
  using (public.owns_plan(plan_id))
  with check (public.owns_plan(plan_id));

create policy medications_all_own on public.medications
  for all to authenticated
  using (public.owns_plan(plan_id))
  with check (public.owns_plan(plan_id));

create policy prep_runs_all_own on public.prep_runs
  for all to authenticated
  using (public.owns_plan(plan_id))
  with check (public.owns_plan(plan_id));

-- storico: si legge e si aggiunge, non si modifica né si cancella
create policy stock_events_select_own on public.stock_events
  for select to authenticated using (public.owns_medication(medication_id));
create policy stock_events_insert_own on public.stock_events
  for insert to authenticated with check (public.owns_medication(medication_id));
revoke update, delete on public.stock_events from authenticated;

-- episodi di avviso: il gestore li legge e può chiuderli (arrivo o nuovo conteggio)
create policy alert_log_select_own on public.alert_log
  for select to authenticated using (public.owns_medication(medication_id));
create policy alert_log_update_own on public.alert_log
  for update to authenticated
  using (public.owns_medication(medication_id))
  with check (public.owns_medication(medication_id));
revoke insert, update, delete on public.alert_log from authenticated;
grant update (closed_at) on public.alert_log to authenticated;

-- esiti degli invii: solo lettura per il gestore
create policy alert_runs_select_own on public.alert_runs
  for select to authenticated using (public.owns_plan(plan_id));
revoke insert, update, delete on public.alert_runs from authenticated;

-- cron_runs: nessuna policy, accessibile solo con la service role
revoke all on public.cron_runs from anon, authenticated;

-- gli utenti non collegati non vedono nulla
revoke all on all tables in schema public from anon;
