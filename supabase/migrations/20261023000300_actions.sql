-- =============================================================================
-- Ta7dy-El-La3eeba: app actions (file 3 of 3)
--
-- The app calls these functions (supabase.rpc('name', {...})) for everything
-- that writes data. Each one checks who is calling and whether they are
-- allowed, then does the work in a single transaction.
-- Error messages are written for humans: the app shows them as-is.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Internal helpers (the app cannot call these directly)
-- -----------------------------------------------------------------------------
create function public.require_user()
returns uuid
language plpgsql stable set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Please sign in first.';
  end if;
  return v_user;
end;
$$;

-- Returns the caller's player id in the group, or raises an error.
create function public.require_member(p_group_id uuid)
returns uuid
language plpgsql stable set search_path = ''
as $$
declare
  v_player uuid;
begin
  select gm.player_id into v_player
  from public.group_members gm
  where gm.group_id = p_group_id and gm.user_id = public.require_user();

  if v_player is null then
    raise exception 'You are not a member of this group.';
  end if;
  return v_player;
end;
$$;

create function public.require_admin(p_group_id uuid)
returns uuid
language plpgsql stable set search_path = ''
as $$
declare
  v_player uuid;
begin
  select gm.player_id into v_player
  from public.group_members gm
  where gm.group_id = p_group_id and gm.user_id = public.require_user() and gm.role = 'admin';

  if v_player is null then
    raise exception 'Only group admins can do this.';
  end if;
  return v_player;
end;
$$;

create function public.load_match(p_match_id uuid)
returns public.matches
language plpgsql stable set search_path = ''
as $$
declare
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found.';
  end if;
  return v_match;
end;
$$;

create function public.write_audit(p_group_id uuid, p_action text, p_details jsonb)
returns void
language sql set search_path = ''
as $$
  insert into public.audit_log (group_id, actor_id, action, details)
  values (p_group_id, auth.uid(), p_action, coalesce(p_details, '{}'::jsonb));
$$;

-- Trims a name and collapses spaces. Works with Arabic and any other script.
create function public.clean_name(p_name text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if v_name = '' then
    raise exception 'Please enter a name.';
  end if;
  return left(v_name, 40);
end;
$$;

-- Random code like KICK-7Q3F. No 0/O or 1/I, so it is easy to read aloud.
create function public.new_invite_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
      if i = 4 then
        v_code := v_code || '-';
      end if;
    end loop;
    exit when not exists (select 1 from public.groups g where g.invite_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- " kick 7q3f " -> "KICK-7Q3F"
create function public.normalize_invite_code(p_code text)
returns text
language sql immutable set search_path = ''
as $$
  select case when length(c) = 8 then left(c, 4) || '-' || right(c, 4) else c end
  from (select regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g') as c) s;
$$;


-- -----------------------------------------------------------------------------
-- Groups and members
-- -----------------------------------------------------------------------------

-- Creates a group. The creator becomes its first admin.
create function public.create_group(p_name text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user   uuid := public.require_user();
  v_group  uuid;
  v_player uuid;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Please enter a group name.';
  end if;

  insert into public.groups (name, invite_code, created_by)
  values (left(trim(p_name), 60), public.new_invite_code(), v_user)
  returning id into v_group;

  insert into public.players (group_id, user_id, display_name)
  values (v_group, v_user, public.clean_name(p_display_name))
  returning id into v_player;

  insert into public.group_members (group_id, user_id, player_id, role)
  values (v_group, v_user, v_player, 'admin');

  insert into public.rating_config (group_id) values (v_group);

  return v_group;
end;
$$;

-- Joins a group with an invite code. If the group has no admin at all (for
-- example the seeded demo group), the person joining becomes admin.
create function public.join_group(p_code text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user   uuid := public.require_user();
  v_group  uuid;
  v_player uuid;
  v_role   text;
begin
  select g.id into v_group
  from public.groups g
  where g.invite_code = public.normalize_invite_code(p_code);

  if v_group is null then
    raise exception 'That invite code is not valid. Check it with your group admin.';
  end if;

  if exists (select 1 from public.group_members gm where gm.group_id = v_group and gm.user_id = v_user) then
    return v_group; -- already a member
  end if;

  -- Rejoining after being removed: keep the old player (and their stats).
  select p.id into v_player from public.players p
  where p.group_id = v_group and p.user_id = v_user;

  if v_player is null then
    insert into public.players (group_id, user_id, display_name)
    values (v_group, v_user, public.clean_name(p_display_name))
    returning id into v_player;
  end if;

  v_role := case
    when exists (select 1 from public.group_members gm where gm.group_id = v_group and gm.role = 'admin')
    then 'member' else 'admin'
  end;

  insert into public.group_members (group_id, user_id, player_id, role)
  values (v_group, v_user, v_player, v_role);

  insert into public.rating_config (group_id) values (v_group) on conflict do nothing;
  perform public.write_audit(v_group, 'member_joined', jsonb_build_object('player_id', v_player, 'role', v_role));
  return v_group;
end;
$$;

create function public.regenerate_invite_code(p_group_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_code text := public.new_invite_code();
begin
  perform public.require_admin(p_group_id);
  update public.groups set invite_code = v_code where id = p_group_id;
  perform public.write_audit(p_group_id, 'invite_code_regenerated', '{}');
  return v_code;
end;
$$;

create function public.disable_invite_code(p_group_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_admin(p_group_id);
  update public.groups set invite_code = null where id = p_group_id;
  perform public.write_audit(p_group_id, 'invite_code_disabled', '{}');
end;
$$;

create function public.set_member_role(p_group_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_admin(p_group_id);

  if p_role not in ('admin', 'member') then
    raise exception 'Unknown role.';
  end if;

  if p_role = 'member'
     and (select count(*) from public.group_members gm where gm.group_id = p_group_id and gm.role = 'admin') <= 1
     and exists (select 1 from public.group_members gm
                 where gm.group_id = p_group_id and gm.user_id = p_user_id and gm.role = 'admin') then
    raise exception 'A group needs at least one admin. Promote someone else first.';
  end if;

  update public.group_members set role = p_role
  where group_id = p_group_id and user_id = p_user_id;

  perform public.write_audit(p_group_id, 'member_role_changed',
    jsonb_build_object('user_id', p_user_id, 'role', p_role));
end;
$$;

-- Removes a member (admins), or leaves the group (anyone, passing their own
-- id). The player and their stats stay, so old results do not change.
create function public.remove_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_user_id = public.require_user() then
    perform public.require_member(p_group_id);
  else
    perform public.require_admin(p_group_id);
  end if;

  if exists (select 1 from public.group_members gm
             where gm.group_id = p_group_id and gm.user_id = p_user_id and gm.role = 'admin')
     and (select count(*) from public.group_members gm where gm.group_id = p_group_id and gm.role = 'admin') <= 1
     and (select count(*) from public.group_members gm where gm.group_id = p_group_id) > 1 then
    raise exception 'A group needs at least one admin. Promote someone else first.';
  end if;

  delete from public.group_members where group_id = p_group_id and user_id = p_user_id;
  perform public.write_audit(p_group_id, 'member_removed', jsonb_build_object('user_id', p_user_id));
end;
$$;


-- -----------------------------------------------------------------------------
-- Matches and lineups
-- -----------------------------------------------------------------------------

-- Writes the lineup of the current (latest) stint and syncs who played.
-- p_lineup: [{"player_id": "...", "team": "A", "is_goalkeeper": false}, ...]
create function public.apply_lineup(p_match_id uuid, p_group_id uuid, p_lineup jsonb)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_lineup jsonb := coalesce(p_lineup, '[]'::jsonb);
  v_ids    uuid[];
  v_stint  uuid;
  v_names  text;
begin
  if jsonb_typeof(v_lineup) <> 'array' then
    raise exception 'The lineup must be a list of players.';
  end if;

  select coalesce(array_agg((e ->> 'player_id')::uuid), '{}') into v_ids
  from jsonb_array_elements(v_lineup) e;

  if cardinality(v_ids) < 2 then
    raise exception 'Pick at least 2 players.';
  end if;
  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then
    raise exception 'A player is listed twice.';
  end if;
  if exists (select 1 from jsonb_array_elements(v_lineup) e
             where coalesce(e ->> 'team', '') not in ('A', 'B')) then
    raise exception 'Every player needs a team (A or B).';
  end if;
  if exists (select 1 from unnest(v_ids) x
             where not exists (select 1 from public.players p where p.id = x and p.group_id = p_group_id)) then
    raise exception 'The lineup contains a player from another group.';
  end if;
  if exists (select 1 from jsonb_array_elements(v_lineup) e
             where coalesce((e ->> 'is_goalkeeper')::boolean, false)
             group by e ->> 'team' having count(*) > 1) then
    raise exception 'Only one goalkeeper per team.';
  end if;

  select s.id into v_stint from public.stints s
  where s.match_id = p_match_id order by s.ordinal desc limit 1;

  if v_stint is null then
    insert into public.stints (match_id, ordinal, weight) values (p_match_id, 1, 1)
    returning id into v_stint;
  end if;

  -- Players being dropped must not have goals or assists in this match.
  select string_agg(p.display_name, ', ') into v_names
  from public.match_players mp
  join public.players p on p.id = mp.player_id
  where mp.match_id = p_match_id
    and mp.player_id <> all (v_ids)
    and not exists (select 1 from public.stint_players sp
                    where sp.match_id = p_match_id and sp.player_id = mp.player_id and sp.stint_id <> v_stint)
    and exists (select 1 from public.goals g
                where g.match_id = p_match_id and (g.scorer_id = mp.player_id or g.assister_id = mp.player_id));

  if v_names is not null then
    raise exception '% scored or assisted in this match. Delete or change those goals first.', v_names;
  end if;

  insert into public.match_players (match_id, player_id)
  select p_match_id, x from unnest(v_ids) x
  on conflict do nothing;

  delete from public.stint_players where stint_id = v_stint;

  insert into public.stint_players (stint_id, match_id, player_id, team, is_goalkeeper)
  select v_stint, p_match_id, (e ->> 'player_id')::uuid, e ->> 'team',
         coalesce((e ->> 'is_goalkeeper')::boolean, false)
  from jsonb_array_elements(v_lineup) e;

  -- If a scorer's team was corrected, their goals follow them.
  update public.goals g
  set scoring_team = sp.team
  from public.stint_players sp
  where g.stint_id = v_stint and sp.stint_id = v_stint
    and sp.player_id = g.scorer_id and g.scoring_team <> sp.team;

  -- Anyone no longer in any stint did not play (their votes are removed too).
  delete from public.match_players mp
  where mp.match_id = p_match_id
    and not exists (select 1 from public.stint_players sp
                    where sp.match_id = p_match_id and sp.player_id = mp.player_id);
end;
$$;

create function public.create_match(p_group_id uuid, p_played_at date, p_location text, p_lineup jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_match uuid;
begin
  perform public.require_admin(p_group_id);

  insert into public.matches (group_id, played_at, location, status, created_by)
  values (p_group_id, coalesce(p_played_at, current_date), nullif(trim(p_location), ''), 'playing', auth.uid())
  returning id into v_match;

  insert into public.stints (match_id, ordinal, weight) values (v_match, 1, 1);
  perform public.apply_lineup(v_match, p_group_id, p_lineup);
  perform public.write_audit(p_group_id, 'match_created', jsonb_build_object('match_id', v_match));
  return v_match;
end;
$$;

create function public.save_lineup(p_match_id uuid, p_lineup jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  if v_match.status = 'closed' then
    raise exception 'Voting is closed, so the lineup is final.';
  end if;

  perform public.apply_lineup(p_match_id, v_match.group_id, p_lineup);
  perform public.write_audit(v_match.group_id, 'lineup_changed',
    jsonb_build_object('match_id', p_match_id, 'lineup', p_lineup));
end;
$$;

create function public.update_match_details(p_match_id uuid, p_played_at date, p_location text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  update public.matches
  set played_at = coalesce(p_played_at, played_at),
      location = nullif(trim(p_location), '')
  where id = p_match_id;
  perform public.write_audit(v_match.group_id, 'match_details_changed',
    jsonb_build_object('match_id', p_match_id, 'played_at', p_played_at, 'location', p_location));
end;
$$;

create function public.delete_match(p_match_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  perform public.write_audit(v_match.group_id, 'match_deleted',
    jsonb_build_object('match_id', p_match_id, 'played_at', v_match.played_at, 'status', v_match.status));
  delete from public.matches where id = p_match_id;
end;
$$;


-- -----------------------------------------------------------------------------
-- Goals
-- -----------------------------------------------------------------------------

-- Any player in the match (or an admin) can log a goal. It is attached to the
-- current stint and to the scorer's team in that stint.
create function public.log_goal(p_match_id uuid, p_scorer_id uuid, p_assister_id uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_match       public.matches := public.load_match(p_match_id);
  v_me          uuid := public.require_member(v_match.group_id);
  v_admin       boolean := public.is_group_admin(v_match.group_id);
  v_stint       uuid;
  v_team        text;
  v_assist_team text;
  v_goal        uuid;
begin
  if not v_admin then
    if v_match.status not in ('playing', 'voting') then
      raise exception 'Goals can no longer be logged for this match. Ask an admin.';
    end if;
    if not exists (select 1 from public.match_players mp where mp.match_id = p_match_id and mp.player_id = v_me) then
      raise exception 'Only players in this match can log goals.';
    end if;
  end if;

  select s.id into v_stint from public.stints s
  where s.match_id = p_match_id order by s.ordinal desc limit 1;

  select sp.team into v_team from public.stint_players sp
  where sp.stint_id = v_stint and sp.player_id = p_scorer_id;
  if v_team is null then
    raise exception 'The scorer is not in the lineup.';
  end if;

  if p_assister_id is not null then
    if p_assister_id = p_scorer_id then
      raise exception 'A player cannot assist their own goal.';
    end if;
    select sp.team into v_assist_team from public.stint_players sp
    where sp.stint_id = v_stint and sp.player_id = p_assister_id;
    if v_assist_team is distinct from v_team then
      raise exception 'The assister must be on the scorer''s team.';
    end if;
  end if;

  insert into public.goals (match_id, stint_id, scoring_team, scorer_id, assister_id, confirmed, created_by)
  values (p_match_id, v_stint, v_team, p_scorer_id, p_assister_id, v_admin, auth.uid())
  returning id into v_goal;

  return v_goal;
end;
$$;

-- Admin fix: change scorer/assister. The goal becomes confirmed and undisputed.
create function public.edit_goal(p_goal_id uuid, p_scorer_id uuid, p_assister_id uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_goal        public.goals;
  v_match       public.matches;
  v_team        text;
  v_assist_team text;
begin
  select * into v_goal from public.goals where id = p_goal_id;
  if not found then
    raise exception 'Goal not found.';
  end if;
  v_match := public.load_match(v_goal.match_id);
  perform public.require_admin(v_match.group_id);

  select sp.team into v_team from public.stint_players sp
  where sp.stint_id = v_goal.stint_id and sp.player_id = p_scorer_id;
  if v_team is null then
    raise exception 'The scorer was not on the pitch at that time.';
  end if;

  if p_assister_id is not null then
    if p_assister_id = p_scorer_id then
      raise exception 'A player cannot assist their own goal.';
    end if;
    select sp.team into v_assist_team from public.stint_players sp
    where sp.stint_id = v_goal.stint_id and sp.player_id = p_assister_id;
    if v_assist_team is distinct from v_team then
      raise exception 'The assister must be on the scorer''s team.';
    end if;
  end if;

  update public.goals
  set scorer_id = p_scorer_id, assister_id = p_assister_id, scoring_team = v_team,
      confirmed = true, disputed = false
  where id = p_goal_id;

  perform public.write_audit(v_match.group_id, 'goal_edited', jsonb_build_object(
    'match_id', v_goal.match_id, 'goal_id', p_goal_id, 'before', to_jsonb(v_goal),
    'scorer_id', p_scorer_id, 'assister_id', p_assister_id));
end;
$$;

-- Admins can delete any goal. The person who logged a goal can undo it
-- until voting closes.
create function public.delete_goal(p_goal_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_goal  public.goals;
  v_match public.matches;
begin
  select * into v_goal from public.goals where id = p_goal_id;
  if not found then
    raise exception 'Goal not found.';
  end if;
  v_match := public.load_match(v_goal.match_id);
  perform public.require_member(v_match.group_id);

  if not public.is_group_admin(v_match.group_id) then
    if v_goal.created_by is distinct from auth.uid() then
      raise exception 'Only an admin or the person who logged this goal can delete it.';
    end if;
    if v_match.status = 'closed' then
      raise exception 'Voting is closed. Ask an admin to fix it.';
    end if;
  end if;

  delete from public.goals where id = p_goal_id;
  perform public.write_audit(v_match.group_id, 'goal_deleted',
    jsonb_build_object('match_id', v_goal.match_id, 'goal', to_jsonb(v_goal)));
end;
$$;

-- The other player involved (scorer or assister, not the person who logged
-- it) or an admin confirms a goal.
create function public.confirm_goal(p_goal_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_goal  public.goals;
  v_match public.matches;
  v_me    uuid;
  v_admin boolean;
begin
  select * into v_goal from public.goals where id = p_goal_id;
  if not found then
    raise exception 'Goal not found.';
  end if;
  v_match := public.load_match(v_goal.match_id);
  v_me := public.require_member(v_match.group_id);
  v_admin := public.is_group_admin(v_match.group_id);

  if not v_admin then
    if not (v_me = v_goal.scorer_id or coalesce(v_me = v_goal.assister_id, false))
       or v_goal.created_by is not distinct from auth.uid() then
      raise exception 'Only the other player involved (or an admin) can confirm this goal.';
    end if;
    if v_goal.disputed then
      raise exception 'This goal is disputed. An admin needs to sort it out.';
    end if;
  end if;

  update public.goals set confirmed = true, disputed = false where id = p_goal_id;
end;
$$;

-- Any player in the match can dispute a goal. Disputed goals do not count
-- until an admin edits or deletes them.
create function public.dispute_goal(p_goal_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_goal  public.goals;
  v_match public.matches;
  v_me    uuid;
begin
  select * into v_goal from public.goals where id = p_goal_id;
  if not found then
    raise exception 'Goal not found.';
  end if;
  v_match := public.load_match(v_goal.match_id);
  v_me := public.require_member(v_match.group_id);

  if v_match.status = 'closed' then
    raise exception 'Voting is closed. Ask an admin to fix it.';
  end if;
  if not public.is_group_admin(v_match.group_id)
     and not exists (select 1 from public.match_players mp where mp.match_id = v_goal.match_id and mp.player_id = v_me) then
    raise exception 'Only players in this match can dispute goals.';
  end if;

  update public.goals set disputed = true, confirmed = false where id = p_goal_id;
  perform public.write_audit(v_match.group_id, 'goal_disputed',
    jsonb_build_object('match_id', v_goal.match_id, 'goal_id', p_goal_id));
end;
$$;


-- -----------------------------------------------------------------------------
-- Finishing a match and the voting window
-- -----------------------------------------------------------------------------

create function public.finish_match(p_match_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_hours int;
begin
  perform public.require_admin(v_match.group_id);

  if v_match.status not in ('draft', 'playing') then
    raise exception 'This match is already finished.';
  end if;
  if (select count(*) from public.match_players mp where mp.match_id = p_match_id) < 2 then
    raise exception 'Add at least 2 players before finishing the match.';
  end if;

  select rc.voting_hours into v_hours from public.rating_config rc where rc.group_id = v_match.group_id;

  update public.matches
  set status = 'voting', voting_closes_at = now() + make_interval(hours => coalesce(v_hours, 24))
  where id = p_match_id;

  perform public.write_audit(v_match.group_id, 'match_finished', jsonb_build_object('match_id', p_match_id));
end;
$$;

create function public.extend_voting(p_match_id uuid, p_hours int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  if v_match.status <> 'voting' then
    raise exception 'Voting is not open for this match.';
  end if;
  if p_hours is null or p_hours not between 1 and 168 then
    raise exception 'Extend by 1 to 168 hours.';
  end if;

  update public.matches
  set voting_closes_at = greatest(voting_closes_at, now()) + make_interval(hours => p_hours)
  where id = p_match_id;

  perform public.write_audit(v_match.group_id, 'voting_extended',
    jsonb_build_object('match_id', p_match_id, 'hours', p_hours));
end;
$$;

-- Closes voting, auto-confirms undisputed goals and calculates the ratings.
-- Returns false if the match was not in the voting state (e.g. someone else
-- closed it a moment earlier).
create function public.finalize_match(p_match_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  -- Lock the match so two people closing at the same moment cannot clash.
  perform 1 from public.matches m where m.id = p_match_id and m.status = 'voting' for update;
  if not found then
    return false;
  end if;

  update public.goals set confirmed = true
  where match_id = p_match_id and not disputed and not confirmed;

  update public.matches
  set status = 'closed', closed_at = now(), voting_closes_at = least(coalesce(voting_closes_at, now()), now())
  where id = p_match_id;

  perform public.compute_match_ratings(p_match_id);
  return true;
end;
$$;

-- Admins can close early. Anyone in the group can close once time is up
-- (the app does this automatically when someone opens it).
create function public.close_voting(p_match_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_member(v_match.group_id);
  if v_match.status <> 'voting' then
    raise exception 'Voting is not open for this match.';
  end if;
  if v_match.voting_closes_at > now() and not public.is_group_admin(v_match.group_id) then
    raise exception 'Voting is still open. Only an admin can close it early.';
  end if;

  if public.finalize_match(p_match_id) then
    perform public.write_audit(v_match.group_id, 'voting_closed', jsonb_build_object('match_id', p_match_id));
  end if;
end;
$$;

-- Closes every match in the group whose voting time is up. Returns how many.
create function public.close_due_matches(p_group_id uuid)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_id    uuid;
  v_count int := 0;
begin
  perform public.require_member(p_group_id);
  for v_id in
    select m.id from public.matches m
    where m.group_id = p_group_id and m.status = 'voting' and m.voting_closes_at <= now()
  loop
    if public.finalize_match(v_id) then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;


-- -----------------------------------------------------------------------------
-- Voting
-- -----------------------------------------------------------------------------

-- Saves the caller's votes for a match. Can be called again to change them
-- until voting closes.
-- p_votes: [{"target_id": "...", "score": 7}, {"target_id": "...", "didnt_see": true}]
-- p_mvp_id: the player picked as Man of the Match (or null for none).
create function public.submit_votes(p_match_id uuid, p_votes jsonb, p_mvp_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_me    uuid := public.require_member(v_match.group_id);
  v_votes jsonb := coalesce(p_votes, '[]'::jsonb);
begin
  if v_match.status <> 'voting' or v_match.voting_closes_at <= now() then
    raise exception 'Voting is closed for this match.';
  end if;
  if not exists (select 1 from public.match_players mp where mp.match_id = p_match_id and mp.player_id = v_me) then
    raise exception 'Only players who played in this match can vote.';
  end if;
  if jsonb_typeof(v_votes) <> 'array' then
    raise exception 'Votes must be a list.';
  end if;

  if exists (select 1 from jsonb_array_elements(v_votes) e where (e ->> 'target_id')::uuid = v_me)
     or p_mvp_id = v_me then
    raise exception 'You cannot vote for yourself.';
  end if;
  if exists (select 1 from jsonb_array_elements(v_votes) e
             where not exists (select 1 from public.match_players mp
                               where mp.match_id = p_match_id and mp.player_id = (e ->> 'target_id')::uuid)) then
    raise exception 'You can only vote for players who played in this match.';
  end if;
  if (select count(*) from jsonb_array_elements(v_votes))
     <> (select count(distinct e ->> 'target_id') from jsonb_array_elements(v_votes) e) then
    raise exception 'A player appears twice in your votes.';
  end if;
  if exists (select 1 from jsonb_array_elements(v_votes) e
             where not coalesce((e ->> 'didnt_see')::boolean, false)
               and coalesce(e ->> 'score', '') !~ '^([1-9]|10)$') then
    raise exception 'Scores must be whole numbers from 1 to 10.';
  end if;

  insert into public.ratings_votes (match_id, voter_id, target_id, score, didnt_see)
  select p_match_id,
         v_me,
         (e ->> 'target_id')::uuid,
         case when coalesce((e ->> 'didnt_see')::boolean, false) then null else (e ->> 'score')::smallint end,
         coalesce((e ->> 'didnt_see')::boolean, false)
  from jsonb_array_elements(v_votes) e
  on conflict (match_id, voter_id, target_id)
  do update set score = excluded.score, didnt_see = excluded.didnt_see, updated_at = now();

  if p_mvp_id is null then
    delete from public.mvp_votes where match_id = p_match_id and voter_id = v_me;
  else
    if not exists (select 1 from public.match_players mp where mp.match_id = p_match_id and mp.player_id = p_mvp_id) then
      raise exception 'Man of the Match must be someone who played.';
    end if;
    insert into public.mvp_votes (match_id, voter_id, target_id)
    values (p_match_id, v_me, p_mvp_id)
    on conflict (match_id, voter_id) do update set target_id = excluded.target_id;
  end if;
end;
$$;

-- Who has voted so far (not WHAT they voted), for "waiting for..." reminders.
create function public.vote_status(p_match_id uuid)
returns table (player_id uuid, has_voted boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_member(v_match.group_id);
  return query
    select mp.player_id,
           exists (select 1 from public.ratings_votes rv where rv.match_id = p_match_id and rv.voter_id = mp.player_id)
           or exists (select 1 from public.mvp_votes mv where mv.match_id = p_match_id and mv.voter_id = mp.player_id)
    from public.match_players mp
    where mp.match_id = p_match_id;
end;
$$;


-- -----------------------------------------------------------------------------
-- Leaderboard
-- Season = calendar year of played_at. p_year = null means all-time.
-- Runs with the caller's permissions, so RLS limits it to their groups.
-- -----------------------------------------------------------------------------
create function public.get_leaderboard(p_group_id uuid, p_year int default null)
returns table (
  player_id        uuid,
  display_name     text,
  matches          int,
  avg_rating       numeric,
  avg_rating_exact numeric,
  goals            int,
  assists          int,
  mvps             int,
  clean_sheets     int,
  avg_votes        numeric,
  qualified        boolean
)
language sql stable security invoker set search_path = ''
as $$
  select p.id,
         p.display_name,
         count(*)::int,
         round(avg(mr.final_rating), 1),
         avg(mr.final_rating),
         sum(mr.goals)::int,
         sum(mr.assists)::int,
         (count(*) filter (where mr.is_mvp))::int,
         sum(mr.clean_sheets)::int,
         round(avg(mr.vote_average), 1),
         count(*) >= coalesce(
           (select rc.min_matches_for_leaderboard from public.rating_config rc where rc.group_id = p_group_id), 3)
  from public.match_ratings mr
  join public.matches m on m.id = mr.match_id
  join public.players p on p.id = mr.player_id
  where m.group_id = p_group_id
    and m.status = 'closed'
    and (p_year is null or extract(year from m.played_at) = p_year)
  group by p.id, p.display_name
  order by avg(mr.final_rating) desc;
$$;


-- =============================================================================
-- Permissions
-- Signed-in users can READ every table (RLS decides which rows). The only
-- direct writes allowed are the columns below; everything else goes through
-- the functions in this file. Signed-out visitors get nothing.
-- =============================================================================
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant update (name) on public.groups to authenticated;
grant update (display_name) on public.players to authenticated;
grant update (w_analytics, w_votes, min_votes, min_matches_for_leaderboard, voting_hours, points)
  on public.rating_config to authenticated;
grant all on all tables in schema public to service_role;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  -- used inside RLS policies
  public.is_group_member(uuid),
  public.is_group_admin(uuid),
  public.my_player_id(uuid),
  public.match_group_id(uuid),
  public.can_see_vote(uuid, uuid),
  -- app actions
  public.create_group(text, text),
  public.join_group(text, text),
  public.regenerate_invite_code(uuid),
  public.disable_invite_code(uuid),
  public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid),
  public.create_match(uuid, date, text, jsonb),
  public.save_lineup(uuid, jsonb),
  public.update_match_details(uuid, date, text),
  public.delete_match(uuid),
  public.log_goal(uuid, uuid, uuid),
  public.edit_goal(uuid, uuid, uuid),
  public.delete_goal(uuid),
  public.confirm_goal(uuid),
  public.dispute_goal(uuid),
  public.finish_match(uuid),
  public.extend_voting(uuid, int),
  public.close_voting(uuid),
  public.close_due_matches(uuid),
  public.submit_votes(uuid, jsonb, uuid),
  public.vote_status(uuid),
  public.get_leaderboard(uuid, int)
to authenticated;
grant execute on all functions in schema public to service_role;
