-- Panoramix · schema di base
-- Date di calendario sempre nel fuso Europe/Rome.

create or replace function public.rome_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Europe/Rome')::date $$;

-- Profilo del gestore (uno per utente di Supabase Auth)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  first_name text not null default '' check (char_length(first_name) <= 60),
  last_name text not null default '' check (char_length(last_name) <= 60),
  created_at timestamptz not null default now()
);

-- Un piano = una persona assistita
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  patient_name text not null check (char_length(btrim(patient_name)) between 1 and 80),
  notes text not null default '' check (char_length(notes) <= 2000),
  stock_mode text not null default 'daily' check (stock_mode in ('daily', 'weekly')),
  -- giorno da cui vale la modalità attuale (serve a calcolare la prima preparazione)
  mode_since date not null default public.rome_today(),
  -- giorno ISO: 1 = lunedì … 7 = domenica
  prep_weekday smallint not null default 7 check (prep_weekday between 1 and 7),
  alert_under_14 boolean not null default true,
  alert_under_7 boolean not null default false,
  alert_last_pack boolean not null default true,
  created_at timestamptz not null default now()
);
create index plans_owner_idx on public.plans (owner_id);

-- Destinatari aggiuntivi degli avvisi (massimo 5 per piano)
create table public.plan_recipients (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  email text not null check (
    char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  created_at timestamptz not null default now(),
  unique (plan_id, email)
);

create or replace function public.enforce_recipients_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  -- blocca il piano per contare in modo affidabile anche con richieste parallele
  perform 1 from public.plans where id = new.plan_id for update;
  if (select count(*) from public.plan_recipients where plan_id = new.plan_id) >= 5 then
    raise exception 'Massimo 5 destinatari aggiuntivi per piano'
      using errcode = 'check_violation', hint = 'recipients_limit';
  end if;
  return new;
end;
$$;

create trigger plan_recipients_limit
before insert on public.plan_recipients
for each row execute function public.enforce_recipients_limit();

-- Medicinali
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  strength text not null default '' check (char_length(strength) <= 40),
  description text not null default '' check (char_length(description) <= 200),
  pills_per_pack integer not null check (pills_per_pack between 1 and 1000),
  requires_prescription boolean not null default false,
  color text not null check (color in ('#FF5E4D', '#FFC020', '#12C2B0', '#8D5BF5', '#93D232', '#2E78F5')),
  shape text not null check (shape in ('tonda', 'ovale', 'capsula')),
  -- dosi per fascia, passo 0,5
  dose_morning numeric(4, 1) not null default 0 check (dose_morning between 0 and 20 and mod(dose_morning * 2, 1) = 0),
  dose_noon numeric(4, 1) not null default 0 check (dose_noon between 0 and 20 and mod(dose_noon * 2, 1) = 0),
  dose_evening numeric(4, 1) not null default 0 check (dose_evening between 0 and 20 and mod(dose_evening * 2, 1) = 0),
  frequency_type text not null check (frequency_type in ('daily', 'weekdays', 'every_n_days', 'cycle', 'as_needed')),
  -- giorni ISO (1 = lunedì … 7 = domenica)
  weekdays smallint[] not null default '{}' check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  interval_days integer check (interval_days between 2 and 365),
  cycle_on integer check (cycle_on between 1 and 365),
  cycle_off integer check (cycle_off between 1 and 365),
  start_date date not null default public.rome_today(),
  end_date date,
  -- conteggio di riferimento: quantità + data (vedi lib/forecast.ts)
  stock_qty numeric(8, 1) not null default 0 check (stock_qty >= 0 and mod(stock_qty * 2, 1) = 0),
  stock_as_of date not null default public.rome_today(),
  ordered_at timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint medications_dose_positive check (dose_morning + dose_noon + dose_evening > 0),
  constraint medications_end_after_start check (end_date is null or end_date >= start_date),
  constraint medications_frequency_params check (
    (frequency_type <> 'weekdays' or cardinality(weekdays) > 0)
    and (frequency_type <> 'every_n_days' or interval_days is not null)
    and (frequency_type <> 'cycle' or (cycle_on is not null and cycle_off is not null))
  )
);
create index medications_plan_idx on public.medications (plan_id);

-- Storico dei movimenti di scorta
create table public.stock_events (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications (id) on delete cascade,
  type text not null check (type in ('count', 'arrival', 'prep', 'prep_undo', 'adjust')),
  delta numeric(8, 1) not null,
  qty_after numeric(8, 1) not null,
  effective_date date not null,
  meta jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index stock_events_medication_idx on public.stock_events (medication_id, created_at desc);

-- Preparazioni del portapillole (servono all'annullamento esatto)
create table public.prep_runs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  week_start date not null,
  -- { "<medication_id>": compresse tolte }
  deductions jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);
create index prep_runs_plan_idx on public.prep_runs (plan_id, week_start desc);
-- una sola preparazione attiva per settimana
create unique index prep_runs_active_week on public.prep_runs (plan_id, week_start) where undone_at is null;

-- Episodi di avviso: uno per medicinale, soglia e inizio episodio
create table public.alert_log (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications (id) on delete cascade,
  alert_type text not null check (alert_type in ('under_14', 'under_7', 'last_pack')),
  episode_start date not null,
  sent_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (medication_id, alert_type, episode_start)
);
-- al massimo un episodio aperto per medicinale e soglia
create unique index alert_log_open_episode on public.alert_log (medication_id, alert_type) where closed_at is null;

-- Un'email al giorno per piano: questa riga rende il cron idempotente
create table public.alert_runs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  run_date date not null,
  status text not null check (status in ('sending', 'sent', 'failed')),
  recipients text[] not null default '{}',
  medication_ids uuid[] not null default '{}',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, run_date)
);

-- Esiti delle esecuzioni del controllo giornaliero (solo service role)
create table public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  run_date date not null,
  plans_checked integer not null default 0,
  emails_sent integer not null default 0,
  errors jsonb not null default '[]'::jsonb
);

-- Nuovo utente di Auth → profilo vuoto da completare con nome e cognome
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row execute function public.handle_user_email_change();
