-- =============================================================================
-- 7GZ-KORA: nights (file 4 of 4)
--
-- Planning a night, "I'm in" / "Out" with a waiting list, check-in at the
-- pitch, ending or cancelling a night, and the rent split
-- (Plans/Football-scenario.md sections 2 and 4, Plans/Extras-and-backlog.md
-- sections 1 and 2).
--
-- A night is still a row in matches. Statuses: draft (planned), playing,
-- voting, closed, cancelled. Same style as file 3: the app calls these
-- functions, which check permissions and write in one transaction.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Planning
-- -----------------------------------------------------------------------------

-- Checks and writes a night's details (used by plan_night and update_night).
-- p_night: {"played_at": "2026-10-29", "starts_at": "2026-10-29T18:00:00Z",
--           "location": "Club pitch 3", "duration_minutes": 120, "cost": 600,
--           "players_per_side": 6, "collector_player_id": "...",
--           "game_minutes": 10, "player_cap": 18}     (player_cap null = no limit)
create function public.write_night_details(p_match_id uuid, p_group_id uuid, p_night jsonb)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_night     jsonb := coalesce(p_night, '{}'::jsonb);
  v_collector uuid := nullif(v_night ->> 'collector_player_id', '')::uuid;
  v_cost      numeric := coalesce((v_night ->> 'cost')::numeric, 0);
  v_side      int := coalesce((v_night ->> 'players_per_side')::int, 6);
  v_length    int := coalesce((v_night ->> 'duration_minutes')::int, 120);
  v_game      int := coalesce((v_night ->> 'game_minutes')::int, 10);
  v_cap       int := (v_night ->> 'player_cap')::int;
begin
  if (v_night ->> 'played_at') is null or (v_night ->> 'starts_at') is null then
    raise exception 'Pick a date and start time.';
  end if;
  if v_cost < 0 or v_cost > 100000 then
    raise exception 'The cost must be between 0 and 100000.';
  end if;
  if v_side not between 5 and 11 then
    raise exception 'Players per side must be between 5 and 11.';
  end if;
  if v_length not between 15 and 600 then
    raise exception 'The booking must last between 15 minutes and 10 hours.';
  end if;
  if v_game not between 1 and 120 then
    raise exception 'A game must last between 1 and 120 minutes.';
  end if;
  if v_cap is not null and v_cap not between 2 and 100 then
    raise exception 'The player limit must be between 2 and 100 (or no limit).';
  end if;
  if v_collector is not null
     and not exists (select 1 from public.players p where p.id = v_collector and p.group_id = p_group_id) then
    raise exception 'The collector must be a player in this group.';
  end if;

  update public.matches
  set played_at           = (v_night ->> 'played_at')::date,
      starts_at           = (v_night ->> 'starts_at')::timestamptz,
      location            = left(nullif(trim(v_night ->> 'location'), ''), 80),
      duration_minutes    = v_length,
      cost                = v_cost,
      players_per_side    = v_side,
      collector_player_id = v_collector,
      game_minutes        = v_game,
      player_cap          = v_cap
  where id = p_match_id;
end;
$$;

-- Plans a night (admins). Everyone can then reply "I'm in" or "Out".
create function public.plan_night(p_group_id uuid, p_night jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_match uuid;
begin
  perform public.require_admin(p_group_id);

  insert into public.matches (group_id, status, created_by)
  values (p_group_id, 'draft', auth.uid())
  returning id into v_match;

  perform public.write_night_details(v_match, p_group_id, p_night);
  perform public.write_audit(p_group_id, 'night_planned', jsonb_build_object('match_id', v_match));
  return v_match;
end;
$$;

-- Edits a night's details (admins). Works in any status, so a cost or
-- collector can still be fixed after the night.
create function public.update_night(p_match_id uuid, p_night jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  perform 1 from public.matches m where m.id = p_match_id for update;

  perform public.write_night_details(p_match_id, v_match.group_id, p_night);
  -- A higher player limit lets people on the waiting list move up.
  if v_match.status = 'draft' then
    perform public.promote_waiting(p_match_id);
  end if;
  perform public.write_audit(v_match.group_id, 'night_changed',
    jsonb_build_object('match_id', p_match_id, 'night', p_night));
end;
$$;


-- -----------------------------------------------------------------------------
-- Replies: "I'm in" / "Out", with a waiting list when the night is full
-- -----------------------------------------------------------------------------

-- True while fewer people are "in" than the night's player limit.
create function public.night_has_space(p_match_id uuid)
returns boolean
language sql stable set search_path = ''
as $$
  select m.player_cap is null
         or (select count(*) from public.rsvps r where r.match_id = m.id and r.status = 'in') < m.player_cap
  from public.matches m
  where m.id = p_match_id;
$$;

-- Moves people up from the waiting list, in the order they joined it, while
-- there is space. Returns the first player moved up (or null).
create function public.promote_waiting(p_match_id uuid)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_first uuid;
  v_next  uuid;
begin
  loop
    exit when not public.night_has_space(p_match_id);

    select r.player_id into v_next
    from public.rsvps r
    where r.match_id = p_match_id and r.status = 'waiting'
    order by r.waiting_since, r.player_id
    limit 1;
    exit when v_next is null;

    update public.rsvps
    set status = 'in', status_changed_at = now(), promoted_at = now(), waiting_since = null
    where match_id = p_match_id and player_id = v_next;

    v_first := coalesce(v_first, v_next);
    v_next := null;
  end loop;
  return v_first;
end;
$$;

-- "I'm in" / "Out" for the calling player, while the night is planned.
-- On a full night "I'm in" joins the waiting list. When someone who was in
-- says "Out", the first person on the waiting list moves up automatically.
-- Returns the caller's new status: in, waiting or out.
create function public.set_rsvp(p_match_id uuid, p_status text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches;
  v_me    uuid;
  v_old   text;
  v_new   text;
begin
  -- Lock the night so two people taking the last spot at once can't both get it.
  select * into v_match from public.matches m where m.id = p_match_id for update;
  if not found then
    raise exception 'Night not found.';
  end if;
  v_me := public.require_member(v_match.group_id);

  if p_status is null or p_status not in ('in', 'out') then
    raise exception 'Reply "in" or "out".';
  end if;
  if v_match.status <> 'draft' then
    raise exception 'Replies are closed: this night has started, finished or been cancelled.';
  end if;

  select r.status into v_old from public.rsvps r
  where r.match_id = p_match_id and r.player_id = v_me;

  -- Tapping the same answer again changes nothing (and keeps your place).
  if (p_status = 'in' and v_old in ('in', 'waiting')) or (p_status = 'out' and v_old = 'out') then
    return v_old;
  end if;

  v_new := case
    when p_status = 'out' then 'out'
    when public.night_has_space(p_match_id) then 'in'
    else 'waiting'
  end;

  insert into public.rsvps (match_id, player_id, status, status_changed_at, waiting_since)
  values (p_match_id, v_me, v_new, now(), case when v_new = 'waiting' then now() end)
  on conflict (match_id, player_id) do update
  set status = excluded.status,
      status_changed_at = excluded.status_changed_at,
      waiting_since = excluded.waiting_since,
      promoted_at = null,
      spot_taken_by = null;

  -- A spot opened up: the first person on the waiting list takes it.
  if v_old = 'in' then
    update public.rsvps
    set spot_taken_by = public.promote_waiting(p_match_id)
    where match_id = p_match_id and player_id = v_me;
  end if;

  return v_new;
end;
$$;


-- -----------------------------------------------------------------------------
-- At the pitch: start the night and check people in
-- -----------------------------------------------------------------------------

-- Starts a planned night (admins): replies close and check-in opens.
create function public.start_night(p_match_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  if v_match.status = 'cancelled' then
    raise exception 'This night was cancelled.';
  elsif v_match.status <> 'draft' then
    raise exception 'This night has already started.';
  end if;

  update public.matches set status = 'playing' where id = p_match_id;
  perform public.write_audit(v_match.group_id, 'night_started', jsonb_build_object('match_id', p_match_id));
end;
$$;

-- Checks a player in (admins); the arrival time is saved. Anyone in the
-- group can be checked in, whether or not they said "I'm in". Checking in
-- someone who left early marks them as back (their arrival time stays).
create function public.check_in(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_open(v_match);
  if not exists (select 1 from public.players p where p.id = p_player_id and p.group_id = v_match.group_id) then
    raise exception 'That player is not in this group.';
  end if;

  insert into public.match_players (match_id, player_id, arrived_at)
  values (p_match_id, p_player_id, now())
  on conflict (match_id, player_id) do update set left_at = null;

  perform public.write_audit(v_match.group_id, 'checked_in',
    jsonb_build_object('match_id', p_match_id, 'player_id', p_player_id));
end;
$$;

-- Marks a player as having left early (admins). They still count for the night.
create function public.check_out(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_open(v_match);

  update public.match_players set left_at = coalesce(left_at, now())
  where match_id = p_match_id and player_id = p_player_id;
  if not found then
    raise exception 'That player is not checked in.';
  end if;

  perform public.write_audit(v_match.group_id, 'checked_out',
    jsonb_build_object('match_id', p_match_id, 'player_id', p_player_id));
end;
$$;

-- Removes a check-in made by mistake (admins). Their place in the teams,
-- their votes and their payment tick go too.
create function public.undo_check_in(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_open(v_match);
  if exists (select 1 from public.goals g
             where g.match_id = p_match_id and (g.scorer_id = p_player_id or g.assister_id = p_player_id))
     or exists (select 1 from public.saves s where s.match_id = p_match_id and s.goalkeeper_id = p_player_id) then
    raise exception 'They scored or assisted tonight (or have saves logged). Delete those first.';
  end if;

  delete from public.night_payments where match_id = p_match_id and player_id = p_player_id;
  delete from public.match_players where match_id = p_match_id and player_id = p_player_id;
  if not found then
    raise exception 'That player is not checked in.';
  end if;

  perform public.write_audit(v_match.group_id, 'check_in_undone',
    jsonb_build_object('match_id', p_match_id, 'player_id', p_player_id));
end;
$$;


-- -----------------------------------------------------------------------------
-- Ending or cancelling a night
-- -----------------------------------------------------------------------------

-- Ends the night (admins): voting opens for everyone checked in, and the
-- money card appears.
create function public.end_night(p_match_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_hours int;
begin
  perform public.require_admin(v_match.group_id);
  if v_match.status <> 'playing' then
    raise exception 'Only a night in progress can be ended.';
  end if;
  if (select count(*) from public.match_players mp where mp.match_id = p_match_id) < 2 then
    raise exception 'Check in at least 2 players before ending the night.';
  end if;

  select rc.voting_hours into v_hours from public.rating_config rc where rc.group_id = v_match.group_id;

  update public.matches
  set status = 'voting', voting_closes_at = now() + make_interval(hours => coalesce(v_hours, 24))
  where id = p_match_id;

  perform public.write_audit(v_match.group_id, 'night_ended', jsonb_build_object('match_id', p_match_id));
end;
$$;

-- Calls off a planned night or one in progress (admins). Nothing counts: no
-- votes and no ratings. p_fee is what the pitch still charges (0 if nothing);
-- it is split like the rent (see night_payer_rows).
create function public.cancel_night(p_match_id uuid, p_reason text, p_note text, p_fee numeric)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_note  text := left(nullif(trim(p_note), ''), 200);
begin
  perform public.require_admin(v_match.group_id);
  if v_match.status not in ('draft', 'playing') then
    raise exception 'Only a planned night or one in progress can be cancelled.';
  end if;
  if p_reason is null or p_reason not in ('rain', 'not_enough_players', 'pitch_problem', 'other') then
    raise exception 'Pick a reason.';
  end if;
  if p_reason = 'other' and v_note is null then
    raise exception 'Add a short note for "other".';
  end if;
  if coalesce(p_fee, 0) < 0 then
    raise exception 'The fee can''t be negative.';
  end if;

  update public.matches
  set status = 'cancelled', cancel_reason = p_reason, cancel_note = v_note,
      cancel_fee = coalesce(p_fee, 0), cancelled_at = now()
  where id = p_match_id;

  perform public.write_audit(v_match.group_id, 'night_cancelled',
    jsonb_build_object('match_id', p_match_id, 'reason', p_reason, 'fee', coalesce(p_fee, 0)));
end;
$$;


-- -----------------------------------------------------------------------------
-- Money: THE rent split (Plans/Football-scenario.md section 4)
--
--   share = amount ÷ number of payers, rounded UP to a whole pound
--
-- The amount is the night's cost (or, for a cancelled night, what the pitch
-- still charges). The payers are everyone checked in. A night cancelled
-- before anyone was checked in splits its fee among those who said "I'm in".
-- The collector is one of the payers and counts as paid automatically.
-- -----------------------------------------------------------------------------
create function public.night_payer_rows(p_match_id uuid)
returns table (player_id uuid, share int, paid_at timestamptz, is_collector boolean)
language sql stable set search_path = ''
as $$
  with night as (
    select m.collector_player_id,
           m.status,
           case when m.status = 'cancelled' then m.cancel_fee else m.cost end as amount
    from public.matches m
    where m.id = p_match_id and m.status in ('voting', 'closed', 'cancelled')
  ),
  checked_in as (
    select mp.player_id from public.match_players mp where mp.match_id = p_match_id
  ),
  payers as (
    select c.player_id from checked_in c
    union all
    select r.player_id
    from public.rsvps r, night n
    where r.match_id = p_match_id and r.status = 'in'
      and n.status = 'cancelled'
      and not exists (select 1 from checked_in)
  )
  select p.player_id,
         ceil(n.amount / count(*) over ())::int,
         np.paid_at,
         p.player_id is not distinct from n.collector_player_id
  from payers p
  cross join night n
  left join public.night_payments np on np.match_id = p_match_id and np.player_id = p.player_id
  where n.amount > 0;
$$;

-- The money card of one night (members).
create function public.night_money(p_match_id uuid)
returns table (player_id uuid, share int, paid_at timestamptz, is_collector boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_member(v_match.group_id);
  return query select * from public.night_payer_rows(p_match_id);
end;
$$;

-- "You owe 47 EGP to Ahmed": the caller's unpaid shares in the group.
create function public.money_owed(p_group_id uuid)
returns table (match_id uuid, played_at date, share int, currency text, collector_player_id uuid)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_member(p_group_id);
begin
  return query
    select m.id, m.played_at, pr.share, m.currency, m.collector_player_id
    from public.matches m
    cross join lateral public.night_payer_rows(m.id) pr
    where m.group_id = p_group_id
      and m.status in ('voting', 'closed', 'cancelled')
      and pr.player_id = v_me
      and pr.paid_at is null
      and not pr.is_collector
    order by m.played_at;
end;
$$;

-- Only the night's collector or an admin ticks payments, and never their own.
create function public.require_payment_keeper(p_match public.matches, p_me uuid, p_player_id uuid)
returns void
language plpgsql stable set search_path = ''
as $$
begin
  if p_player_id = p_me then
    raise exception 'You can''t tick off your own share. Ask the collector.';
  end if;
  if p_me is distinct from p_match.collector_player_id and not public.is_group_admin(p_match.group_id) then
    raise exception 'Only the collector or an admin can tick off payments.';
  end if;
end;
$$;

-- Ticks a player's share as paid back to the collector.
create function public.mark_paid(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_me    uuid := public.require_member(v_match.group_id);
  v_payer record;
begin
  perform public.require_payment_keeper(v_match, v_me, p_player_id);

  select * into v_payer from public.night_payer_rows(p_match_id) r where r.player_id = p_player_id;
  if not found then
    raise exception 'That player has nothing to pay for this night.';
  end if;
  if v_payer.is_collector then
    raise exception 'The collector counts as paid automatically.';
  end if;

  insert into public.night_payments (match_id, player_id, marked_by)
  values (p_match_id, p_player_id, auth.uid())
  on conflict (match_id, player_id) do nothing;

  perform public.write_audit(v_match.group_id, 'payment_marked',
    jsonb_build_object('match_id', p_match_id, 'player_id', p_player_id));
end;
$$;

-- Removes a tick made by mistake.
create function public.unmark_paid(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_me    uuid := public.require_member(v_match.group_id);
begin
  perform public.require_payment_keeper(v_match, v_me, p_player_id);
  delete from public.night_payments where match_id = p_match_id and player_id = p_player_id;
  perform public.write_audit(v_match.group_id, 'payment_unmarked',
    jsonb_build_object('match_id', p_match_id, 'player_id', p_player_id));
end;
$$;


-- =============================================================================
-- Permissions (same rules as the end of file 3). Internal helpers stay
-- private; the app actions are for signed-in users.
-- =============================================================================
revoke execute on function
  public.write_night_details(uuid, uuid, jsonb),
  public.night_has_space(uuid),
  public.promote_waiting(uuid),
  public.night_payer_rows(uuid),
  public.require_payment_keeper(public.matches, uuid, uuid),
  public.plan_night(uuid, jsonb),
  public.update_night(uuid, jsonb),
  public.set_rsvp(uuid, text),
  public.start_night(uuid),
  public.check_in(uuid, uuid),
  public.check_out(uuid, uuid),
  public.undo_check_in(uuid, uuid),
  public.end_night(uuid),
  public.cancel_night(uuid, text, text, numeric),
  public.night_money(uuid),
  public.money_owed(uuid),
  public.mark_paid(uuid, uuid),
  public.unmark_paid(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.plan_night(uuid, jsonb),
  public.update_night(uuid, jsonb),
  public.set_rsvp(uuid, text),
  public.start_night(uuid),
  public.check_in(uuid, uuid),
  public.check_out(uuid, uuid),
  public.undo_check_in(uuid, uuid),
  public.end_night(uuid),
  public.cancel_night(uuid, text, text, numeric),
  public.night_money(uuid),
  public.money_owed(uuid),
  public.mark_paid(uuid, uuid),
  public.unmark_paid(uuid, uuid)
to authenticated;

grant execute on all functions in schema public to service_role;
