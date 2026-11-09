-- Panoramix · assunzioni al bisogno, cambi di dose programmati, promemoria e riepiloghi

-- ——— Assunzioni al bisogno: nuovo tipo di movimento "use" ———

alter table public.stock_events drop constraint stock_events_type_check;
alter table public.stock_events add constraint stock_events_type_check
  check (type in ('count', 'arrival', 'prep', 'prep_undo', 'adjust', 'use'));

create or replace function public.record_stock_event(
  p_medication_id uuid,
  p_type text,
  p_delta numeric,
  p_qty_after numeric,
  p_effective_date date,
  p_expected_qty numeric,
  p_expected_as_of date,
  p_clear_ordered boolean default false,
  p_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if p_type not in ('count', 'arrival', 'adjust', 'use') then
    raise exception 'Tipo di movimento non valido' using errcode = '22023';
  end if;

  update public.medications
     set stock_qty = p_qty_after,
         stock_as_of = p_effective_date,
         ordered_at = case when p_clear_ordered then null else ordered_at end
   where id = p_medication_id
     and stock_qty = p_expected_qty
     and stock_as_of = p_expected_as_of;

  if not found then
    raise exception 'Le scorte sono cambiate nel frattempo' using errcode = '40001', hint = 'stale_stock';
  end if;

  insert into public.stock_events (medication_id, type, delta, qty_after, effective_date, meta)
  values (p_medication_id, p_type, p_delta, p_qty_after, p_effective_date, coalesce(p_meta, '{}'::jsonb))
  returning id into v_event_id;

  return v_event_id;
end;
$$;

-- ——— Cambi di dose programmati ———
-- Dal giorno effective_date le dosi delle tre fasce diventano quelle indicate
-- (la frequenza resta quella del medicinale). Dose totale 0 = sospensione.

create table public.dose_changes (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications (id) on delete cascade,
  effective_date date not null,
  dose_morning numeric(4, 1) not null default 0 check (dose_morning between 0 and 20 and mod(dose_morning * 2, 1) = 0),
  dose_noon numeric(4, 1) not null default 0 check (dose_noon between 0 and 20 and mod(dose_noon * 2, 1) = 0),
  dose_evening numeric(4, 1) not null default 0 check (dose_evening between 0 and 20 and mod(dose_evening * 2, 1) = 0),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (medication_id, effective_date)
);
create index dose_changes_created_by_idx on public.dose_changes (created_by);

alter table public.dose_changes enable row level security;
create policy dose_changes_select on public.dose_changes
  for select to authenticated using (public.can_view_medication(medication_id));
create policy dose_changes_insert on public.dose_changes
  for insert to authenticated with check (public.can_edit_medication(medication_id));
create policy dose_changes_update on public.dose_changes
  for update to authenticated
  using (public.can_edit_medication(medication_id))
  with check (public.can_edit_medication(medication_id));
create policy dose_changes_delete on public.dose_changes
  for delete to authenticated using (public.can_edit_medication(medication_id));
revoke all on public.dose_changes from anon;

-- ——— Promemoria e riepilogo settimanale ———

alter table public.plans
  add column prep_reminder boolean not null default true,
  add column weekly_summary boolean not null default false;

-- Un invio al giorno per piano e tipo: rende idempotenti promemoria e riepiloghi
create table public.notification_runs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  kind text not null check (kind in ('prep_reminder', 'weekly_summary')),
  run_date date not null,
  status text not null check (status in ('sending', 'sent', 'failed')),
  recipients text[] not null default '{}',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, kind, run_date)
);

alter table public.notification_runs enable row level security;
create policy notification_runs_select_own on public.notification_runs
  for select to authenticated using (public.owns_plan(plan_id));
revoke insert, update, delete on public.notification_runs from authenticated;
revoke all on public.notification_runs from anon;

-- I controlli automatici sono due: avvisi del mattino e promemoria della sera
alter table public.cron_runs
  add column kind text not null default 'alerts' check (kind in ('alerts', 'reminders'));
create index cron_runs_kind_date_idx on public.cron_runs (kind, run_date);
