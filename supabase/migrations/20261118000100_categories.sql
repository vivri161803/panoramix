-- Appoteca · dieci categorie per i medicinali (rilascio 2 della feature «categorie»).
-- medications.category prende il posto di form e delle forme dei presidi; shape resta solo per le
-- pillole. Un medicinale è «a livello» se ha days_per_pack (il vecchio reorder_days): la scorta si
-- conta in contenitori (flaconi, tubi, inalatori) e scende di 1 / days_per_pack per giorno di uso.
-- Le quantità non si arrotondano più a mezze unità nel database.
-- Prima di applicarla: pg_dump del database di produzione, deploy fuori dagli orari dei cron.
-- Nessun begin/commit esplicito: la CLI di Supabase applica ogni file di migrazione in una transazione.

-- 1-2. Categoria dalle 11 coppie (form, shape) ammesse oggi: dipende solo da form
alter table public.medications add column category text;

update public.medications set category = case form
  when 'compressa' then 'pillola'
  when 'iniezione' then 'iniezione'
  when 'cerotto' then 'cerotto'
  when 'collirio' then 'gocce'
end;

-- 3. Nessuna categoria nulla
do $$
begin
  assert not exists (select 1 from public.medications where category is null), 'medicinali senza categoria';
end;
$$;

-- 4. Dieci valori
alter table public.medications alter column category set not null;
alter table public.medications add constraint medications_category_check check (
  category in ('pillola', 'bustina', 'liquido', 'iniezione', 'gocce', 'inalatore', 'cerotto', 'crema', 'supposta', 'altro')
);

-- 5. reorder_days diventa days_per_pack: dopo la rinomina sono a livello solo gli ex flaconi
alter table public.medications drop constraint medications_reorder_days_flacone;
alter table public.medications rename column reorder_days to days_per_pack;
alter table public.medications drop constraint medications_reorder_days_check;
alter table public.medications add constraint medications_days_per_pack_check check (days_per_pack between 1 and 365);

-- 6. Flaconi: un flacone in casa, uno per confezione, stessa data di esaurimento (stock_as_of + days_per_pack).
--    Un flacone al bisogno si conta a pezzi.
update public.medications
set stock_qty = 1,
    pills_per_pack = 1,
    days_per_pack = case when frequency_type = 'as_needed' then null else days_per_pack end
where shape = 'flacone';

do $$
begin
  assert not exists (
    select 1 from public.medications
    where shape = 'flacone' and days_per_pack is null and frequency_type <> 'as_needed'
  ), 'flaconi senza days_per_pack';
end;
$$;

-- 7. shape solo per le pillole
alter table public.medications drop constraint medications_shape_check;
alter table public.medications alter column shape drop not null;
update public.medications set shape = null where category <> 'pillola';
alter table public.medications add constraint medications_shape_check check (
  (category = 'pillola') = (shape is not null)
  and (shape is null or shape in ('tonda', 'ovale', 'capsula'))
);

-- 8. form non serve più (il suo check se ne va con la colonna)
alter table public.medications drop column form;

-- 9. Tipi e limiti: dosi fino a 999 a passi di 0,5, scorta senza scala né passo, fino a 10.000 per confezione
alter table public.medications
  drop constraint medications_dose_morning_check,
  drop constraint medications_dose_noon_check,
  drop constraint medications_dose_evening_check,
  drop constraint medications_stock_qty_check,
  drop constraint medications_pills_per_pack_check;
alter table public.medications
  alter column dose_morning type numeric(5, 1),
  alter column dose_noon type numeric(5, 1),
  alter column dose_evening type numeric(5, 1),
  alter column stock_qty type numeric;
alter table public.medications
  add constraint medications_dose_morning_check check (dose_morning between 0 and 999 and mod(dose_morning * 2, 1) = 0),
  add constraint medications_dose_noon_check check (dose_noon between 0 and 999 and mod(dose_noon * 2, 1) = 0),
  add constraint medications_dose_evening_check check (dose_evening between 0 and 999 and mod(dose_evening * 2, 1) = 0),
  add constraint medications_stock_qty_check check (stock_qty >= 0),
  add constraint medications_pills_per_pack_check check (pills_per_pack between 1 and 10000);

alter table public.dose_changes
  drop constraint dose_changes_dose_morning_check,
  drop constraint dose_changes_dose_noon_check,
  drop constraint dose_changes_dose_evening_check;
alter table public.dose_changes
  alter column dose_morning type numeric(5, 1),
  alter column dose_noon type numeric(5, 1),
  alter column dose_evening type numeric(5, 1);
alter table public.dose_changes
  add constraint dose_changes_dose_morning_check check (dose_morning between 0 and 999 and mod(dose_morning * 2, 1) = 0),
  add constraint dose_changes_dose_noon_check check (dose_noon between 0 and 999 and mod(dose_noon * 2, 1) = 0),
  add constraint dose_changes_dose_evening_check check (dose_evening between 0 and 999 and mod(dose_evening * 2, 1) = 0);

alter table public.stock_events
  alter column delta type numeric,
  alter column qty_after type numeric;

-- 10. Un medicinale al bisogno si conta sempre a pezzi
alter table public.medications add constraint medications_days_per_pack_as_needed check (
  frequency_type <> 'as_needed' or days_per_pack is null
);
