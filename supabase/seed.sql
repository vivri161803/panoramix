-- DATI D'ESEMPIO — solo per prove, non usare con dati veri.
-- Crea il piano "[ESEMPIO] Nonna Anna" con quattro medicine per l'utente indicato.
-- Uso: accedi una volta all'app con la tua email, poi esegui questo file nell'SQL Editor
-- di Supabase dopo aver sostituito l'indirizzo qui sotto.

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

  insert into public.plans (owner_id, patient_name, notes, stock_mode, prep_weekday, alert_under_14, alert_under_7, alert_last_pack, mode_since)
  values (v_owner, '[ESEMPIO] Nonna Anna', 'Piano di esempio creato da supabase/seed.sql', 'weekly', 7, true, false, true, v_today)
  returning id into v_plan;

  insert into public.medications (plan_id, name, strength, description, pills_per_pack, requires_prescription, color, shape,
    dose_morning, dose_noon, dose_evening, frequency_type, weekdays, start_date, stock_qty, stock_as_of)
  values
    (v_plan, 'Cardioaspirina', '100 mg', 'Dopo pranzo', 30, false, '#FF5E4D', 'tonda', 0, 1, 0, 'daily', '{}', v_today, 5, v_today),
    (v_plan, 'Ramipril', '5 mg', 'Pressione', 28, true, '#FFC020', 'capsula', 1, 0, 0, 'daily', '{}', v_today, 16, v_today),
    (v_plan, 'Atorvastatina', '20 mg', 'Colesterolo', 30, false, '#2E78F5', 'ovale', 0, 0, 1, 'daily', '{}', v_today, 42, v_today),
    (v_plan, 'Vitamina D', '25.000 UI', 'La domenica', 4, false, '#8D5BF5', 'capsula', 0, 1, 0, 'weekdays', '{7}', v_today, 3, v_today);

  for v_med in select id from public.medications where plan_id = v_plan loop
    insert into public.stock_events (medication_id, type, delta, qty_after, effective_date, meta, created_by)
    select id, 'count', stock_qty, stock_qty, v_today, '{"initial": true, "seed": true}', v_owner
    from public.medications where id = v_med;
  end loop;
end $$;
