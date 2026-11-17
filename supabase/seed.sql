-- DATI D'ESEMPIO — solo per prove, non usare con dati veri.
-- 1) Poche righe AIFA vere (vedi tests/helpers/aifa-sample.ts): confezioni, una carente e un
--    gruppo di equivalenza. In produzione queste tabelle le riempie scripts/import-aifa.mjs.
-- 2) Il piano "[ESEMPIO] Nonna Anna" con cinque medicine per l'utente indicato.
-- Uso: accedi una volta all'app con la tua email, poi esegui questo file nell'SQL Editor
-- di Supabase dopo aver sostituito l'indirizzo qui sotto.

insert into public.aifa_packs (aic, name, pack_description, form, atc_code, dose_units, rx_regime, import_id) values
  ('027161064', 'TRIATEC', '<5 MG COMPRESSE> 14 COMPRESSE IN BLISTER PVC/AL', 'Compressa', 'C09AA05', 14, 'Medicinali soggetti a prescrizione medica', '00000000-0000-4000-8000-00000000a1fa'),
  ('050238118', 'RAMIPRIL ALTER', '5 MG COMPRESSE-  14 COMPRESSE IN BLISTER OPA/AL/PVC/AL', 'Compressa', 'C09AA05', 14, 'Medicinali soggetti a prescrizione medica', '00000000-0000-4000-8000-00000000a1fa'),
  ('024840074', 'CARDIOASPIRIN', '100 MG COMPRESSE GASTRORESISTENTI-30 COMPRESSE', 'Compressa gastroresistente', 'B01AC06', 30, 'Medicinali soggetti a prescrizione medica', '00000000-0000-4000-8000-00000000a1fa'),
  ('047612027', 'ACARBOSIO AUROBINDO', '50 MG COMPRESSE- 40 COMPRESSE IN BLISTER PVC/PE/PVDC/AL', 'Compressa', 'A10BF01', 40, 'Medicinali soggetti a prescrizione medica', '00000000-0000-4000-8000-00000000a1fa'),
  ('044091039', 'AMLODIPINA E VALSARTAN DOC', '10 MG/160 MG COMPRESSE RIVESTITE CON FILM- 28 COMPRESSE IN BLISTER PVC/PVDC/AL', 'Compressa rivestita con film', 'C09DB01', 28, 'Medicinali soggetti a prescrizione medica', '00000000-0000-4000-8000-00000000a1fa'),
  ('026783098', 'MEPRAL', '20 MG CAPSULE RIGIDE GASTRORESISTENTI- 14 CAPSULE', 'Capsula rigida gastroresistente', 'A02BC01', 14, 'Medicinali soggetti a prescrizione medica', '00000000-0000-4000-8000-00000000a1fa')
on conflict (aic) do nothing;

insert into public.aifa_pack_ingredients (aic, position, ingredient, qty, unit, import_id) values
  ('027161064', 1, 'RAMIPRIL', 5, 'milligrammi', '00000000-0000-4000-8000-00000000a1fa'),
  ('050238118', 1, 'RAMIPRIL', 5, 'milligrammi', '00000000-0000-4000-8000-00000000a1fa'),
  ('024840074', 1, 'ACIDO ACETILSALICILICO', 100, 'milligrammi', '00000000-0000-4000-8000-00000000a1fa'),
  ('047612027', 1, 'ACARBOSIO', 50, 'milligrammi', '00000000-0000-4000-8000-00000000a1fa'),
  ('044091039', 1, 'AMLODIPINA', 10, 'milligrammi', '00000000-0000-4000-8000-00000000a1fa'),
  ('044091039', 2, 'VALSARTAN', 160, 'milligrammi', '00000000-0000-4000-8000-00000000a1fa'),
  ('026783098', 1, 'OMEPRAZOLO', 20, 'milligrammi', '00000000-0000-4000-8000-00000000a1fa')
on conflict (aic, position) do nothing;

insert into public.aifa_shortages (aic, name, ingredient, form_strength, started_on, expected_end, equivalent, reasons, aifa_suggestions, atc_code, import_id)
select '047612027', 'ACARBOSIO AUROBINDO', 'ACARBOSIO', '"50 MG COMPRESSE" 40 COMPRESSE IN BLISTER PVC/PE/PVDC/AL', '2026-06-30', '2026-12-31', 'Sì',
       'Problemi produttivi', 'Disponibilità di medicinali equivalenti', 'A10BF01', '00000000-0000-4000-8000-00000000a1fa'
where not exists (select 1 from public.aifa_shortages where aic = '047612027');

insert into public.aifa_transparency (aic, ingredient, reference_pack, atc_code, name, pack_description, reference_price, public_price, price_difference, group_code, prices_as_of, import_id) values
  ('027161064', 'Ramipril', '14 UNITA'' 5 MG - USO ORALE', 'C09AA05', 'TRIATEC', '"5 MG COMPRESSE" 14 COMPRESSE', 1.80, 3.40, 1.60, 'DRA', '2026-10-15', '00000000-0000-4000-8000-00000000a1fa'),
  ('050238118', 'Ramipril', '14 UNITA'' 5 MG - USO ORALE', 'C09AA05', 'RAMIPRIL ALTER', '"5 MG COMPRESSE" 14 COMPRESSE IN BLISTER OPA/AL/PVC/AL', 1.80, 1.80, 0.00, 'DRA', '2026-10-15', '00000000-0000-4000-8000-00000000a1fa'),
  ('038273025', 'Ramipril', '14 UNITA'' 5 MG - USO ORALE', 'C09AA05', 'KRUPIL', '"5 MG COMPRESSE" 14 COMPRESSE DIVISIBILI', 1.80, 2.17, 0.37, 'DRA', '2026-10-15', '00000000-0000-4000-8000-00000000a1fa')
on conflict (aic) do nothing;

do $$
declare
  v_email text := 'sostituisci@esempio.it';
  v_owner uuid;
  v_plan uuid;
  v_today date := public.rome_today();
  v_med uuid;
begin
  select id into v_owner from public.profiles where email = lower(v_email);
  if v_owner is null then
    raise exception 'Nessun profilo per %: accedi prima all''app con questa email', v_email;
  end if;

  insert into public.plans (owner_id, patient_name, notes, prep_reminder, prep_weekday, alert_under_14, alert_under_7, alert_last_pack)
  values (v_owner, '[ESEMPIO] Nonna Anna', 'Piano di esempio creato da supabase/seed.sql', true, 7, true, false, true)
  returning id into v_plan;

  -- colore = gruppo ATC (lib/atc.ts): C corallo, B turchese, A giallo, R azzurro, D nocciola, N viola
  -- un medicinale per categoria; sciroppo, collirio, inalatore e crema a livello (days_per_pack)
  insert into public.medications (plan_id, name, strength, description, pills_per_pack, requires_prescription, color, category, shape,
    days_per_pack, aic, atc_code, dose_morning, dose_noon, dose_evening, frequency_type, weekdays, start_date, stock_qty, stock_as_of)
  values
    (v_plan, 'Cardioaspirin', 'Acido acetilsalicilico 100 mg', 'Dopo pranzo', 30, true, '#12C2B0', 'pillola', 'tonda', null, '024840074', 'B01AC06', 0, 1, 0, 'daily', '{}', v_today, 5, v_today),
    (v_plan, 'Ramipril Alter', 'Ramipril 5 mg', 'Pressione', 14, true, '#FF5E4D', 'pillola', 'tonda', null, '050238118', 'C09AA05', 1, 0, 0, 'daily', '{}', v_today, 16, v_today),
    (v_plan, 'Acarbosio Aurobindo', 'Acarbosio 50 mg', 'Glicemia, a pranzo', 40, true, '#FFC020', 'pillola', 'tonda', null, '047612027', 'A10BF01', 0, 1, 0, 'daily', '{}', v_today, 22, v_today),
    (v_plan, 'Atorvastatina', '20 mg', 'Colesterolo', 30, false, '#FF5E4D', 'pillola', 'ovale', null, null, 'C', 0, 0, 1, 'daily', '{}', v_today, 42, v_today),
    (v_plan, 'Vitamina D', '25.000 UI', 'La domenica', 4, false, '#FFC020', 'pillola', 'capsula', null, null, 'A', 0, 1, 0, 'weekdays', '{7}', v_today, 3, v_today),
    (v_plan, 'Macrogol', '10 g', 'Sciolto in acqua', 20, false, '#FFC020', 'bustina', null, null, null, 'A', 1, 0, 0, 'daily', '{}', v_today, 9, v_today),
    (v_plan, 'Lattulosio', '66,7 g/100 ml', 'Sciroppo', 1, false, '#FFC020', 'liquido', null, 15, null, 'A', 15, 0, 0, 'daily', '{}', v_today, 1, v_today),
    (v_plan, 'Enoxaparina', '4000 UI', 'Sottocute', 6, true, '#12C2B0', 'iniezione', null, null, null, 'B', 0, 0, 1, 'daily', '{}', v_today, 12, v_today),
    (v_plan, 'Timololo collirio', '0,5%', 'Una goccia per occhio', 1, true, '#4FC3F7', 'gocce', null, 30, null, 'S', 1, 0, 1, 'daily', '{}', v_today, 2, v_today),
    (v_plan, 'Salmeterolo', '25 mcg', 'Due spruzzi', 1, true, '#4FC3F7', 'inalatore', null, 30, null, 'R', 2, 0, 2, 'daily', '{}', v_today, 1, v_today),
    (v_plan, 'Fentanil cerotto', '25 mcg/h', 'Lunedì e giovedì', 5, true, '#8D5BF5', 'cerotto', null, null, null, 'N', 1, 0, 0, 'weekdays', '{1,4}', v_today, 7, v_today),
    (v_plan, 'Diclofenac gel', '1%', 'Sul ginocchio', 1, false, '#FF5E4D', 'crema', null, 20, null, 'M', 0, 0, 1, 'daily', '{}', v_today, 1, v_today),
    (v_plan, 'Tachipirina supposte', '1000 mg', 'Se febbre', 10, false, '#8D5BF5', 'supposta', null, null, null, 'N', 1, 0, 0, 'as_needed', '{}', v_today, 6, v_today),
    (v_plan, 'Ausilio', '', 'Altro', 10, false, '#9AA1A9', 'altro', null, null, null, null, 1, 0, 0, 'daily', '{}', v_today, 3, v_today);

  for v_med in select id from public.medications where plan_id = v_plan loop
    insert into public.stock_events (medication_id, type, delta, qty_after, effective_date, meta, created_by)
    select id, 'count', stock_qty, stock_qty, v_today, '{"initial": true, "seed": true}', v_owner
    from public.medications where id = v_med;
  end loop;
end $$;
