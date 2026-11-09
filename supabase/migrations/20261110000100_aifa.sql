-- Panoramix · dati AIFA (anagrafica confezioni, principi attivi, ATC, carenze, lista di trasparenza)
-- Le tabelle aifa_* sono di riferimento: lettura per chi ha fatto l'accesso, scrittura solo con la
-- service role (scripts/import-aifa.mjs). Formati dei file: scripts/aifa/README.md.

-- ——— Registro degli import ———

create table public.aifa_imports (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('confezioni', 'principi_attivi', 'atc', 'carenze', 'trasparenza')),
  file_sha256 text,
  rows integer,
  -- data dichiarata nel file (carenze: "aggiornato al", trasparenza: data dei prezzi)
  source_date date,
  -- skipped: file identico all'ultimo import riuscito, vale come controllo riuscito
  status text not null default 'running' check (status in ('running', 'ok', 'skipped', 'failed')),
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index aifa_imports_source_idx on public.aifa_imports (source, started_at desc);

-- ——— Tabelle di riferimento ———

create table public.aifa_packs (
  aic text primary key check (aic ~ '^\d{9}$'),
  name text not null,
  pack_description text not null default '',
  form text not null default '',
  atc_code text,
  -- compresse o capsule per confezione, ricavate dalla descrizione (il file non ha la colonna)
  dose_units integer,
  -- regime di fornitura in parole, colonna FORNITURA
  rx_regime text,
  import_id uuid not null
);

create table public.aifa_pack_ingredients (
  aic text not null check (aic ~ '^\d{9}$'),
  position smallint not null,
  ingredient text not null,
  qty numeric,
  unit text,
  import_id uuid not null,
  primary key (aic, position)
);

create table public.aifa_atc (
  code text primary key,
  description text not null,
  import_id uuid not null
);

create table public.aifa_shortages (
  id bigint generated always as identity primary key,
  aic text not null check (aic ~ '^\d{9}$'),
  name text not null default '',
  ingredient text not null default '',
  form_strength text not null default '',
  started_on date,
  expected_end date,
  equivalent text not null default '',
  reasons text not null default '',
  aifa_suggestions text not null default '',
  aifa_note text not null default '',
  atc_code text,
  import_id uuid not null
);
create index aifa_shortages_aic_idx on public.aifa_shortages (aic);

create table public.aifa_transparency (
  aic text primary key check (aic ~ '^\d{9}$'),
  ingredient text not null default '',
  reference_pack text not null default '',
  atc_code text,
  name text not null default '',
  pack_description text not null default '',
  reference_price numeric(10, 2),
  public_price numeric(10, 2),
  price_difference numeric(10, 2),
  note text not null default '',
  group_code text not null,
  prices_as_of date,
  import_id uuid not null
);
create index aifa_transparency_group_idx on public.aifa_transparency (group_code);

-- ——— Accesso ———

alter table public.aifa_imports enable row level security;
alter table public.aifa_packs enable row level security;
alter table public.aifa_pack_ingredients enable row level security;
alter table public.aifa_atc enable row level security;
alter table public.aifa_shortages enable row level security;
alter table public.aifa_transparency enable row level security;

create policy aifa_packs_read on public.aifa_packs for select to authenticated using (true);
create policy aifa_pack_ingredients_read on public.aifa_pack_ingredients for select to authenticated using (true);
create policy aifa_atc_read on public.aifa_atc for select to authenticated using (true);
create policy aifa_shortages_read on public.aifa_shortages for select to authenticated using (true);
create policy aifa_transparency_read on public.aifa_transparency for select to authenticated using (true);

revoke all on public.aifa_packs, public.aifa_pack_ingredients, public.aifa_atc, public.aifa_shortages, public.aifa_transparency
  from anon, authenticated;
grant select on public.aifa_packs, public.aifa_pack_ingredients, public.aifa_atc, public.aifa_shortages, public.aifa_transparency
  to authenticated;
-- registro degli import: solo service role
revoke all on public.aifa_imports from anon, authenticated;

-- Data dei dati per la scheda Disponibilità: ultimo controllo riuscito di ogni sorgente.
create or replace function public.aifa_status()
returns table (source text, source_date date, checked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (i.source) i.source, i.source_date, i.finished_at
  from public.aifa_imports i
  where i.status in ('ok', 'skipped')
  order by i.source, i.finished_at desc
$$;

-- Chiude un import: cancella le righe dei giri precedenti e registra l'esito.
-- Gira nel database, così la cancellazione di 160.000 righe non passa dall'API.
create or replace function public.aifa_finish_import(p_import_id uuid, p_rows integer, p_source_date date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source text;
begin
  select source into v_source from public.aifa_imports where id = p_import_id and status = 'running';
  if v_source is null then
    raise exception 'Import % non trovato o già chiuso', p_import_id using errcode = '22023';
  end if;
  case v_source
    when 'confezioni' then delete from public.aifa_packs where import_id <> p_import_id;
    when 'principi_attivi' then delete from public.aifa_pack_ingredients where import_id <> p_import_id;
    when 'atc' then delete from public.aifa_atc where import_id <> p_import_id;
    when 'carenze' then delete from public.aifa_shortages where import_id <> p_import_id;
    when 'trasparenza' then delete from public.aifa_transparency where import_id <> p_import_id;
  end case;
  update public.aifa_imports
     set status = 'ok', rows = p_rows, source_date = p_source_date, finished_at = now()
   where id = p_import_id;
end;
$$;

revoke all on function public.aifa_status() from public, anon;
grant execute on function public.aifa_status() to authenticated;
revoke all on function public.aifa_finish_import(uuid, integer, date) from public, anon, authenticated;
grant execute on function public.aifa_finish_import(uuid, integer, date) to service_role;

-- ——— Medicinali: codice AIC e gruppo ATC ———

alter table public.medications
  add column aic text check (aic ~ '^\d{9}$'),
  -- codice ATC completo (C09AA05) o solo la lettera del gruppo, se scelto a mano
  add column atc_code text check (atc_code ~ '^[A-Z]([0-9]{2}([A-Z]([A-Z]([0-9]{2})?)?)?)?$');

-- Il colore lo calcola il server dal gruppo ATC (lib/atc.ts). Le prime sei tinte sono quelle di
-- prima: i medicinali non ancora aggiornati restano validi. L'ultimo è il grigio di "Non so".
alter table public.medications drop constraint medications_color_check;
alter table public.medications add constraint medications_color_check check (color in (
  '#FF5E4D', '#FFC020', '#12C2B0', '#8D5BF5', '#93D232', '#2E78F5',
  '#F25CA2', '#FF8A1F', '#4FC3F7', '#2E9E5A', '#B23A5B', '#A8703F', '#F9A8D4', '#8E8A2C',
  '#9AA1A9'
));
