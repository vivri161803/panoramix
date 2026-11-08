-- Panoramix · operazioni atomiche sulle scorte
-- Tutte "security invoker": valgono le regole RLS dell'utente collegato.
-- I calcoli (scorta attuale, dosi della settimana) li fa lib/forecast.ts;
-- qui si salva il risultato in un'unica transazione.

-- Movimento su un medicinale: "ribasa" il riferimento (quantità + data) e lo registra nello storico.
-- p_expected_* evita di sovrascrivere un movimento arrivato nel frattempo.
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
  if p_type not in ('count', 'arrival', 'adjust') then
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

-- "Portapillole preparato": toglie dalle scorte le dosi dei 7 giorni da p_week_start.
-- p_items = [{ "medication_id": "...", "take": 7 }, ...]
create or replace function public.apply_prep(
  p_plan_id uuid,
  p_week_start date,
  p_today date,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_item jsonb;
  v_take numeric;
  v_after numeric;
  v_deductions jsonb := '{}'::jsonb;
begin
  if not exists (select 1 from public.plans where id = p_plan_id and stock_mode = 'weekly') then
    raise exception 'Piano non trovato o non in modalità settimanale' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_take := (v_item ->> 'take')::numeric;
    if v_take is null or v_take < 0 then
      raise exception 'Quantità non valida' using errcode = '22023';
    end if;
    v_deductions := v_deductions || jsonb_build_object(v_item ->> 'medication_id', v_take);
  end loop;

  -- l'indice unico impedisce due preparazioni attive per la stessa settimana
  insert into public.prep_runs (plan_id, week_start, deductions)
  values (p_plan_id, p_week_start, v_deductions)
  returning id into v_run_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_take := (v_item ->> 'take')::numeric;
    if v_take > 0 then
      update public.medications
         set stock_qty = stock_qty - v_take,
             stock_as_of = p_today
       where id = (v_item ->> 'medication_id')::uuid
         and plan_id = p_plan_id
      returning stock_qty into v_after;

      if not found then
        raise exception 'Medicinale non trovato' using errcode = '22023';
      end if;

      insert into public.stock_events (medication_id, type, delta, qty_after, effective_date, meta)
      values ((v_item ->> 'medication_id')::uuid, 'prep', -v_take, v_after, p_today,
              jsonb_build_object('prep_run_id', v_run_id, 'week_start', p_week_start));
    end if;
  end loop;

  return v_run_id;
end;
$$;

-- Annulla l'ultima preparazione: restituisce esattamente quanto tolto.
create or replace function public.undo_prep(p_run_id uuid, p_today date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run public.prep_runs;
  v_key text;
  v_take numeric;
  v_after numeric;
begin
  select * into v_run from public.prep_runs where id = p_run_id for update;
  if not found then
    raise exception 'Preparazione non trovata' using errcode = '22023';
  end if;
  if v_run.undone_at is not null then
    raise exception 'Preparazione già annullata' using errcode = '22023', hint = 'already_undone';
  end if;
  if exists (
    select 1 from public.prep_runs r
    where r.plan_id = v_run.plan_id and r.undone_at is null and r.week_start > v_run.week_start
  ) then
    raise exception 'Si può annullare solo l''ultima preparazione' using errcode = '22023', hint = 'not_latest';
  end if;

  for v_key, v_take in select key, value::numeric from jsonb_each_text(v_run.deductions) loop
    if v_take > 0 then
      update public.medications
         set stock_qty = stock_qty + v_take,
             stock_as_of = p_today
       where id = v_key::uuid and plan_id = v_run.plan_id
      returning stock_qty into v_after;

      -- un medicinale eliminato nel frattempo si salta
      if found then
        insert into public.stock_events (medication_id, type, delta, qty_after, effective_date, meta)
        values (v_key::uuid, 'prep_undo', v_take, v_after, p_today,
                jsonb_build_object('prep_run_id', v_run.id, 'week_start', v_run.week_start));
      end if;
    end if;
  end loop;

  update public.prep_runs set undone_at = now() where id = p_run_id;
end;
$$;

-- Cambio di modalità: obbliga a ricontare. p_counts = [{ "medication_id": "...", "qty": 12 }, ...]
create or replace function public.change_stock_mode(
  p_plan_id uuid,
  p_mode text,
  p_today date,
  p_counts jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_qty numeric;
  v_old numeric;
begin
  if p_mode not in ('daily', 'weekly') then
    raise exception 'Modalità non valida' using errcode = '22023';
  end if;

  update public.plans set stock_mode = p_mode, mode_since = p_today where id = p_plan_id;
  if not found then
    raise exception 'Piano non trovato' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_counts, '[]'::jsonb)) loop
    v_qty := (v_item ->> 'qty')::numeric;
    select stock_qty into v_old from public.medications
     where id = (v_item ->> 'medication_id')::uuid and plan_id = p_plan_id
     for update;
    if not found then
      raise exception 'Medicinale non trovato' using errcode = '22023';
    end if;

    update public.medications
       set stock_qty = v_qty, stock_as_of = p_today
     where id = (v_item ->> 'medication_id')::uuid;

    insert into public.stock_events (medication_id, type, delta, qty_after, effective_date, meta)
    values ((v_item ->> 'medication_id')::uuid, 'count',
            v_qty - coalesce((v_item ->> 'previous')::numeric, v_old), v_qty, p_today,
            jsonb_build_object('reason', 'mode_change', 'mode', p_mode));
  end loop;
end;
$$;

-- Eliminazione dell'account e di tutti i dati (a cascata da auth.users)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.record_stock_event(uuid, text, numeric, numeric, date, numeric, date, boolean, jsonb) from public, anon;
revoke all on function public.apply_prep(uuid, date, date, jsonb) from public, anon;
revoke all on function public.undo_prep(uuid, date) from public, anon;
revoke all on function public.change_stock_mode(uuid, text, date, jsonb) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.rome_today() from anon;
revoke all on function public.enforce_recipients_limit() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_email_change() from public, anon, authenticated;

grant execute on function public.record_stock_event(uuid, text, numeric, numeric, date, numeric, date, boolean, jsonb) to authenticated;
grant execute on function public.apply_prep(uuid, date, date, jsonb) to authenticated;
grant execute on function public.undo_prep(uuid, date) to authenticated;
grant execute on function public.change_stock_mode(uuid, text, date, jsonb) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
