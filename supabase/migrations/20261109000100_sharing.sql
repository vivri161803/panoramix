-- Panoramix · piani condivisi
-- Il gestore (proprietario) può dare accesso al piano ad altre persone con un account:
--   viewer = sola lettura, editor = può modificare medicinali e scorte.
-- Impostazioni del piano, destinatari, persone con accesso ed eliminazione restano del solo proprietario.

-- Persone con accesso al piano (oltre al proprietario)
create table public.plan_members (
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);
create index plan_members_user_idx on public.plan_members (user_id);
create index plan_members_invited_by_idx on public.plan_members (invited_by);

-- Inviti in attesa: si accettano entrando in Panoramix con l'email invitata
create table public.plan_invites (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  email text not null check (
    char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  role text not null check (role in ('viewer', 'editor')),
  invited_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (plan_id, email)
);
create index plan_invites_email_idx on public.plan_invites (email);
create index plan_invites_invited_by_idx on public.plan_invites (invited_by);

-- Al massimo 10 persone (membri + inviti in attesa) per piano
create or replace function public.enforce_invites_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  perform 1 from public.plans where id = new.plan_id for update;
  if (select count(*) from public.plan_invites where plan_id = new.plan_id)
     + (select count(*) from public.plan_members where plan_id = new.plan_id) >= 10 then
    raise exception 'Massimo 10 persone con accesso per piano'
      using errcode = 'check_violation', hint = 'members_limit';
  end if;
  return new;
end;
$$;

create trigger plan_invites_limit
before insert on public.plan_invites
for each row execute function public.enforce_invites_limit();

alter table public.plan_members enable row level security;
alter table public.plan_invites enable row level security;

-- ——— Ruolo dell'utente collegato su un piano ———

-- 'owner', 'editor', 'viewer' oppure null (nessun accesso)
create or replace function public.plan_role(p_plan_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.plans p where p.id = p_plan_id and p.owner_id = (select auth.uid())) then 'owner'
    else (select m.role from public.plan_members m where m.plan_id = p_plan_id and m.user_id = (select auth.uid()))
  end
$$;

create or replace function public.can_view_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select public.plan_role(p_plan_id) is not null $$;

create or replace function public.can_edit_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(public.plan_role(p_plan_id) in ('owner', 'editor'), false) $$;

create or replace function public.can_view_medication(p_medication_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((select public.can_view_plan(m.plan_id) from public.medications m where m.id = p_medication_id), false) $$;

create or replace function public.can_edit_medication(p_medication_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((select public.can_edit_plan(m.plan_id) from public.medications m where m.id = p_medication_id), false) $$;

-- L'utente collegato e p_user_id condividono almeno un piano? (per vedere nome e cognome)
create or replace function public.shares_plan_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select id as plan_id from public.plans where owner_id = (select auth.uid())
    union
    select plan_id from public.plan_members where user_id = (select auth.uid())
  ),
  theirs as (
    select id as plan_id from public.plans where owner_id = p_user_id
    union
    select plan_id from public.plan_members where user_id = p_user_id
  )
  select exists (select 1 from mine join theirs using (plan_id))
$$;

-- ——— Regole di accesso aggiornate ———

drop policy plans_all_own on public.plans;
-- owner_id diretto: serve anche a rileggere la riga appena inserita (insert … returning),
-- che le funzioni di controllo non vedono ancora
create policy plans_select on public.plans
  for select to authenticated using (owner_id = (select auth.uid()) or public.can_view_plan(id));
create policy plans_insert_own on public.plans
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy plans_update_own on public.plans
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy plans_delete_own on public.plans
  for delete to authenticated using (owner_id = (select auth.uid()));

drop policy medications_all_own on public.medications;
create policy medications_select on public.medications
  for select to authenticated using (public.can_view_plan(plan_id));
create policy medications_insert on public.medications
  for insert to authenticated with check (public.can_edit_plan(plan_id));
create policy medications_update on public.medications
  for update to authenticated
  using (public.can_edit_plan(plan_id))
  with check (public.can_edit_plan(plan_id));
create policy medications_delete on public.medications
  for delete to authenticated using (public.can_edit_plan(plan_id));

drop policy prep_runs_all_own on public.prep_runs;
create policy prep_runs_select on public.prep_runs
  for select to authenticated using (public.can_view_plan(plan_id));
create policy prep_runs_insert on public.prep_runs
  for insert to authenticated with check (public.can_edit_plan(plan_id));
create policy prep_runs_update on public.prep_runs
  for update to authenticated
  using (public.can_edit_plan(plan_id))
  with check (public.can_edit_plan(plan_id));
create policy prep_runs_delete on public.prep_runs
  for delete to authenticated using (public.can_edit_plan(plan_id));

drop policy stock_events_select_own on public.stock_events;
drop policy stock_events_insert_own on public.stock_events;
create policy stock_events_select on public.stock_events
  for select to authenticated using (public.can_view_medication(medication_id));
create policy stock_events_insert on public.stock_events
  for insert to authenticated with check (public.can_edit_medication(medication_id));

drop policy alert_log_select_own on public.alert_log;
drop policy alert_log_update_own on public.alert_log;
create policy alert_log_select on public.alert_log
  for select to authenticated using (public.can_view_medication(medication_id));
create policy alert_log_update on public.alert_log
  for update to authenticated
  using (public.can_edit_medication(medication_id))
  with check (public.can_edit_medication(medication_id));

-- nome e cognome di chi condivide un piano con me
create policy profiles_select_shared on public.profiles
  for select to authenticated using (public.shares_plan_with(id));

-- membri: li vede il proprietario e il membro stesso; il proprietario cambia il ruolo,
-- il proprietario o il membro stesso possono togliere l'accesso. Si entra solo accettando un invito.
create policy plan_members_select on public.plan_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.owns_plan(plan_id));
create policy plan_members_update on public.plan_members
  for update to authenticated
  using (public.owns_plan(plan_id))
  with check (public.owns_plan(plan_id));
create policy plan_members_delete on public.plan_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.owns_plan(plan_id));
revoke insert, update on public.plan_members from authenticated;
grant update (role) on public.plan_members to authenticated;

-- inviti: li gestisce il proprietario; l'invitato può solo rifiutarli (gli altri dati arrivano da my_plan_invites)
create policy plan_invites_select on public.plan_invites
  for select to authenticated using (public.owns_plan(plan_id));
create policy plan_invites_insert on public.plan_invites
  for insert to authenticated with check (public.owns_plan(plan_id));
create policy plan_invites_update on public.plan_invites
  for update to authenticated
  using (public.owns_plan(plan_id))
  with check (public.owns_plan(plan_id));
create policy plan_invites_delete on public.plan_invites
  for delete to authenticated
  using (
    public.owns_plan(plan_id)
    or email = lower((select p.email from public.profiles p where p.id = (select auth.uid())))
  );
revoke update on public.plan_invites from authenticated;
grant update (role) on public.plan_invites to authenticated;

-- ——— Inviti per l'utente collegato ———

create or replace function public.my_plan_invites()
returns table (id uuid, plan_id uuid, patient_name text, role text, owner_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.plan_id, p.patient_name, i.role,
         btrim(coalesce(o.first_name, '') || ' ' || coalesce(o.last_name, '')) as owner_name,
         i.created_at
    from public.plan_invites i
    join public.plans p on p.id = i.plan_id
    left join public.profiles o on o.id = p.owner_id
   where i.email = lower((select pr.email from public.profiles pr where pr.id = (select auth.uid())))
     and p.owner_id <> (select auth.uid())
   order by i.created_at
$$;

-- Accetta un invito indirizzato all'email dell'utente collegato. Restituisce il piano.
create or replace function public.accept_plan_invite(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.plan_invites;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;
  select lower(email) into v_email from public.profiles where id = auth.uid();
  select * into v_invite from public.plan_invites where id = p_invite_id and email = v_email for update;
  if not found then
    raise exception 'Invito non trovato' using errcode = '22023', hint = 'invite_not_found';
  end if;

  if not exists (select 1 from public.plans where id = v_invite.plan_id and owner_id = auth.uid()) then
    insert into public.plan_members (plan_id, user_id, role, invited_by)
    values (v_invite.plan_id, auth.uid(), v_invite.role, v_invite.invited_by)
    on conflict (plan_id, user_id) do update set role = excluded.role;
  end if;

  delete from public.plan_invites where id = v_invite.id;
  return v_invite.plan_id;
end;
$$;

revoke all on function public.plan_role(uuid) from public, anon;
revoke all on function public.can_view_plan(uuid) from public, anon;
revoke all on function public.can_edit_plan(uuid) from public, anon;
revoke all on function public.can_view_medication(uuid) from public, anon;
revoke all on function public.can_edit_medication(uuid) from public, anon;
revoke all on function public.shares_plan_with(uuid) from public, anon;
revoke all on function public.my_plan_invites() from public, anon;
revoke all on function public.accept_plan_invite(uuid) from public, anon;
revoke all on function public.enforce_invites_limit() from public, anon, authenticated;

grant execute on function public.plan_role(uuid) to authenticated;
grant execute on function public.can_view_plan(uuid) to authenticated;
grant execute on function public.can_edit_plan(uuid) to authenticated;
grant execute on function public.can_view_medication(uuid) to authenticated;
grant execute on function public.can_edit_medication(uuid) to authenticated;
grant execute on function public.shares_plan_with(uuid) to authenticated;
grant execute on function public.my_plan_invites() to authenticated;
grant execute on function public.accept_plan_invite(uuid) to authenticated;

revoke all on public.plan_members from anon;
revoke all on public.plan_invites from anon;
