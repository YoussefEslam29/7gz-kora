-- =============================================================================
-- 7GZ-KORA: accounts, groups and chat (file 8 of 8)
--
-- Plans/Accounts-groups-and-chat.md:
--   1. The player card moves onto the account (profiles), filled in once.
--      Each group's player keeps a copy, written by the database whenever
--      the account changes, so everything that reads players keeps working.
--      With "Show my stats" off, the copy has no skills.
--   2. Groups get a photo (Supabase Storage) and a Public / Private switch.
--      Anyone signed in can find public groups and join with one tap, and
--      search players by name to open their account page.
--   3. Every group gets a text chat (live, through Supabase Realtime).
--   4. Nights get a Google Maps link and the pitch's map position.
--
-- Files 1 to 7 already run on the live project, so this file only adds to
-- them. Run it once, in the SQL Editor. It can run at any time, even during
-- a night. compute_match_ratings and the money functions are not touched.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The account
-- -----------------------------------------------------------------------------

-- The card from file 7 (same rules), "happy in goal" from file 5, and three new things.
alter table public.profiles
  add column shirt_number smallint
    constraint profiles_shirt_number_check check (shirt_number between 1 and 99),
  add column strong_foot text
    constraint profiles_strong_foot_check check (strong_foot in ('right', 'left', 'both')),
  add column favourite_position text
    constraint profiles_favourite_position_check
      check (favourite_position in ('goal', 'defence', 'midfield', 'attack', 'anywhere')),
  add column motto text
    constraint profiles_motto_check check (char_length(motto) between 1 and 60),
  add column skill_shooting smallint
    constraint profiles_skill_shooting_check check (skill_shooting between 1 and 10),
  add column skill_passing smallint
    constraint profiles_skill_passing_check check (skill_passing between 1 and 10),
  add column skill_dribbling smallint
    constraint profiles_skill_dribbling_check check (skill_dribbling between 1 and 10),
  add column skill_defending smallint
    constraint profiles_skill_defending_check check (skill_defending between 1 and 10),
  add column skill_fitness smallint
    constraint profiles_skill_fitness_check check (skill_fitness between 1 and 10),
  add constraint profiles_skills_all_or_none check (
    num_nulls(skill_shooting, skill_passing, skill_dribbling, skill_defending, skill_fitness) in (0, 5)
  ),
  add column happy_in_goal boolean not null default false,
  -- Off: nobody else sees the five skills or the self-rating.
  add column show_stats boolean not null default true,
  -- Where people pay this player by InstaPay when they collect: an Egyptian mobile number.
  add column instapay_phone text
    constraint profiles_instapay_phone_check check (instapay_phone ~ '^01[0125][0-9]{8}$'),
  -- Set once the sign-up questions are done (even if every one was skipped).
  add column onboarded_at timestamptz;

-- The group copy carries the switch and the number too (the card columns are there since file 7).
alter table public.players
  add column show_stats boolean not null default true,
  add column instapay_phone text
    constraint players_instapay_phone_check check (instapay_phone ~ '^01[0125][0-9]{8}$');

-- Writes an account's card onto all its players (one per group). The skills
-- only when the account shows its stats, so a hidden self-rating never
-- reaches anyone else's phone.
create function public.copy_card_to_players(p_user_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.players p
  set shirt_number       = a.shirt_number,
      strong_foot        = a.strong_foot,
      favourite_position = a.favourite_position,
      motto              = a.motto,
      skill_shooting     = case when a.show_stats then a.skill_shooting end,
      skill_passing      = case when a.show_stats then a.skill_passing end,
      skill_dribbling    = case when a.show_stats then a.skill_dribbling end,
      skill_defending    = case when a.show_stats then a.skill_defending end,
      skill_fitness      = case when a.show_stats then a.skill_fitness end,
      happy_in_goal      = a.happy_in_goal,
      show_stats         = a.show_stats,
      instapay_phone     = a.instapay_phone
  from public.profiles a
  where a.id = p_user_id and p.user_id = a.id;
$$;

create function public.profiles_copy_card()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.copy_card_to_players(new.id);
  return null;
end;
$$;

create trigger profiles_copy_card
  after update of shirt_number, strong_foot, favourite_position, motto,
                  skill_shooting, skill_passing, skill_dribbling, skill_defending, skill_fitness,
                  happy_in_goal, show_stats, instapay_phone
  on public.profiles
  for each row execute function public.profiles_copy_card();

-- A new player (joining or creating a group) starts with the account's card.
create function public.players_take_card()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_account public.profiles;
begin
  if new.user_id is null then
    return new;
  end if;
  select * into v_account from public.profiles where id = new.user_id;
  if found then
    new.shirt_number       := v_account.shirt_number;
    new.strong_foot        := v_account.strong_foot;
    new.favourite_position := v_account.favourite_position;
    new.motto              := v_account.motto;
    new.skill_shooting     := case when v_account.show_stats then v_account.skill_shooting end;
    new.skill_passing      := case when v_account.show_stats then v_account.skill_passing end;
    new.skill_dribbling    := case when v_account.show_stats then v_account.skill_dribbling end;
    new.skill_defending    := case when v_account.show_stats then v_account.skill_defending end;
    new.skill_fitness      := case when v_account.show_stats then v_account.skill_fitness end;
    new.happy_in_goal      := v_account.happy_in_goal;
    new.show_stats         := v_account.show_stats;
    new.instapay_phone     := v_account.instapay_phone;
  end if;
  return new;
end;
$$;

create trigger players_take_card
  before insert on public.players
  for each row execute function public.players_take_card();

-- Cards that already exist: each account takes its most complete one (the
-- most filled-in fields; if two are equal, the newer player), "happy in
-- goal" if it was on in any group, and counts as signed up when it has a
-- card. The trigger above then copies it to every group.
update public.profiles a
set shirt_number       = best.shirt_number,
    strong_foot        = best.strong_foot,
    favourite_position = best.favourite_position,
    motto              = best.motto,
    skill_shooting     = best.skill_shooting,
    skill_passing      = best.skill_passing,
    skill_dribbling    = best.skill_dribbling,
    skill_defending    = best.skill_defending,
    skill_fitness      = best.skill_fitness,
    happy_in_goal      = best.any_goal,
    onboarded_at       = case when best.filled > 0 then now() end
from (
  select distinct on (p.user_id)
         p.user_id, p.shirt_number, p.strong_foot, p.favourite_position, p.motto,
         p.skill_shooting, p.skill_passing, p.skill_dribbling, p.skill_defending, p.skill_fitness,
         bool_or(p.happy_in_goal) over (partition by p.user_id) as any_goal,
         num_nonnulls(p.shirt_number, p.strong_foot, p.favourite_position, p.motto, p.skill_shooting,
                      p.skill_passing, p.skill_dribbling, p.skill_defending, p.skill_fitness) as filled
  from public.players p
  where p.user_id is not null
  order by p.user_id, filled desc, p.created_at desc
) best
where a.id = best.user_id;

-- Players change their card on their account only (save_my_account); the
-- copies are written by the database. Renaming yourself in a group stays
-- allowed (file 3). On profiles the new columns are private (read through
-- my_account and get_account); the old ones stay readable as before.
revoke update (shirt_number, strong_foot, favourite_position, motto,
               skill_shooting, skill_passing, skill_dribbling, skill_defending, skill_fitness,
               happy_in_goal)
  on public.players from authenticated;
revoke select on public.profiles from authenticated;
grant select (id, email, display_name, avatar_url, created_at) on public.profiles to authenticated;

-- Your own account, the private columns included.
create function public.my_account()
returns public.profiles
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_account public.profiles;
begin
  select * into v_account from public.profiles where id = public.require_user();
  return v_account;
end;
$$;

-- Saves your account: the name, the card, "happy in goal", Show my stats and
-- the InstaPay number, all at once (a field left out is cleared). The group
-- copies follow (profiles_copy_card). Your name inside each group stays.
-- p_account: {"display_name": "Omar", "shirt_number": 10, "strong_foot": "left",
--             "favourite_position": "attack", "motto": "Pass it to me",
--             "skill_shooting": 8, "skill_passing": 7, "skill_dribbling": 8,
--             "skill_defending": 6, "skill_fitness": 9, "happy_in_goal": false,
--             "show_stats": true, "instapay_phone": "01012345678"}
create function public.save_my_account(p_account jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user  uuid := public.require_user();
  v       jsonb := coalesce(p_account, '{}'::jsonb);
  v_phone text := nullif(regexp_replace(coalesce(v ->> 'instapay_phone', ''), '\s', '', 'g'), '');
begin
  if v_phone is not null and v_phone !~ '^01[0125][0-9]{8}$' then
    raise exception 'That InstaPay number doesn''t look right. Use an Egyptian mobile number, like 010 1234 5678.';
  end if;
  if num_nulls(v ->> 'skill_shooting', v ->> 'skill_passing', v ->> 'skill_dribbling',
               v ->> 'skill_defending', v ->> 'skill_fitness') not in (0, 5) then
    raise exception 'Rate all five skills, or none.';
  end if;

  update public.profiles
  set display_name       = public.clean_name(v ->> 'display_name'),
      shirt_number       = (v ->> 'shirt_number')::smallint,
      strong_foot        = v ->> 'strong_foot',
      favourite_position = v ->> 'favourite_position',
      motto              = nullif(trim(v ->> 'motto'), ''),
      skill_shooting     = (v ->> 'skill_shooting')::smallint,
      skill_passing      = (v ->> 'skill_passing')::smallint,
      skill_dribbling    = (v ->> 'skill_dribbling')::smallint,
      skill_defending    = (v ->> 'skill_defending')::smallint,
      skill_fitness      = (v ->> 'skill_fitness')::smallint,
      happy_in_goal      = coalesce((v ->> 'happy_in_goal')::boolean, false),
      show_stats         = coalesce((v ->> 'show_stats')::boolean, true),
      instapay_phone     = v_phone
  where id = v_user;
end;
$$;

-- The end of the sign-up questions: saves the answers and marks you as signed up.
create function public.finish_sign_up(p_account jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.save_my_account(p_account);
  update public.profiles set onboarded_at = coalesce(onboarded_at, now()) where id = auth.uid();
end;
$$;

-- Find: accounts whose name contains the text (2 or more characters), at
-- most 20. Never an email or phone number.
create function public.search_accounts(p_query text)
returns table (user_id uuid, display_name text, avatar_url text, shirt_number smallint, favourite_position text)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.display_name, a.avatar_url, a.shirt_number, a.favourite_position
  from public.profiles a
  where auth.uid() is not null
    and char_length(trim(coalesce(p_query, ''))) >= 2
    and a.display_name ilike
        '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by a.display_name
  limit 20;
$$;

revoke execute on function
  public.copy_card_to_players(uuid),
  public.profiles_copy_card(),
  public.players_take_card(),
  public.my_account(),
  public.save_my_account(jsonb),
  public.finish_sign_up(jsonb),
  public.search_accounts(text)
from public, anon, authenticated;

grant execute on function
  public.my_account(),
  public.save_my_account(jsonb),
  public.finish_sign_up(jsonb),
  public.search_accounts(text)
to authenticated;


-- -----------------------------------------------------------------------------
-- 2. Groups: photo, Public / Private, Find and account pages
-- -----------------------------------------------------------------------------
alter table public.groups
  -- The group photo, in its own folder of the "group-images" bucket.
  add column image_path text,
  -- Public: anyone signed in can find it in Find and join with one tap.
  add column is_public boolean not null default false,
  add constraint groups_image_path_check check (image_path ~ ('^' || id::text || '/[A-Za-z0-9._-]{1,100}$'));

-- Admins change both straight on the table, under "admins rename their groups" (file 1).
grant update (image_path, is_public) on public.groups to authenticated;

-- The bucket: anyone with a photo's address can see it (the Find list needs
-- that); only the group's admins add, replace or delete its photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-images', 'group-images', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- True when the file's folder is a group you're an admin of.
create function public.is_group_admin_folder(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id::text = (storage.foldername(p_name))[1]
      and gm.user_id = auth.uid() and gm.role = 'admin'
  );
$$;

create policy "group admins see their group's photo files" on storage.objects
  for select to authenticated
  using (bucket_id = 'group-images' and public.is_group_admin_folder(name));
create policy "group admins add group photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'group-images' and public.is_group_admin_folder(name));
create policy "group admins replace group photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'group-images' and public.is_group_admin_folder(name))
  with check (bucket_id = 'group-images' and public.is_group_admin_folder(name));
create policy "group admins delete group photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'group-images' and public.is_group_admin_folder(name));

-- Someone's account page: the card (the skills only if they show their
-- stats, or it's you), totals across all their groups, and their groups you
-- may see: the public ones and the ones you share. Never email or phone.
create function public.get_account(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me      uuid := public.require_user();
  v_account public.profiles;
  v_show    boolean;
begin
  select * into v_account from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Player not found.';
  end if;
  v_show := v_account.show_stats or v_account.id = v_me;

  return jsonb_build_object(
    'user_id', v_account.id,
    'display_name', v_account.display_name,
    'avatar_url', v_account.avatar_url,
    'shirt_number', v_account.shirt_number,
    'strong_foot', v_account.strong_foot,
    'favourite_position', v_account.favourite_position,
    'motto', v_account.motto,
    'happy_in_goal', v_account.happy_in_goal,
    'show_stats', v_account.show_stats,
    'skill_shooting', case when v_show then v_account.skill_shooting end,
    'skill_passing', case when v_show then v_account.skill_passing end,
    'skill_dribbling', case when v_show then v_account.skill_dribbling end,
    'skill_defending', case when v_show then v_account.skill_defending end,
    'skill_fitness', case when v_show then v_account.skill_fitness end,
    -- Rated nights (voting closed), the goals in them that count, and Man of the Match awards.
    'nights', (select count(*) from public.match_players mp
               join public.players p on p.id = mp.player_id
               join public.matches m on m.id = mp.match_id
               where p.user_id = v_account.id and m.status = 'closed'),
    'goals', (select count(*) from public.goals g
              join public.players p on p.id = g.scorer_id
              join public.matches m on m.id = g.match_id
              where p.user_id = v_account.id and m.status = 'closed' and not g.disputed),
    'mvps', (select count(*) from public.match_ratings mr
             join public.players p on p.id = mr.player_id
             join public.matches m on m.id = mr.match_id
             where p.user_id = v_account.id and m.status = 'closed' and mr.is_mvp),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', g.id,
               'name', g.name,
               'image_path', g.image_path,
               'is_public', g.is_public,
               'i_am_in', public.is_group_member(g.id),
               'player_id', case when public.is_group_member(g.id) then gm.player_id end
             ) order by g.name)
      from public.group_members gm
      join public.groups g on g.id = gm.group_id
      where gm.user_id = v_account.id and (g.is_public or public.is_group_member(g.id))
    ), '[]'::jsonb)
  );
end;
$$;

-- Find: every public group, most members first, with the next planned night.
create function public.list_public_groups()
returns table (id uuid, name text, image_path text, members bigint, i_am_in boolean,
               next_night_day date, next_night_at timestamptz, next_night_location text)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.name, g.image_path,
         (select count(*) from public.group_members gm where gm.group_id = g.id),
         public.is_group_member(g.id),
         n.played_at, n.starts_at, n.location
  from public.groups g
  left join lateral (
    select m.played_at, m.starts_at, m.location
    from public.matches m
    where m.group_id = g.id and m.status = 'draft' and m.played_at >= current_date
    order by m.played_at, m.starts_at
    limit 1
  ) n on true
  where g.is_public and auth.uid() is not null
  order by 4 desc, g.name;
$$;

-- One-tap join for public groups. Uses the account name unless another is
-- given. Someone an admin removed needs an invite code (join_group, file 3).
-- Rejoining keeps your old player and stats, as with a code.
create function public.join_public_group(p_group_id uuid, p_display_name text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user   uuid := public.require_user();
  v_player uuid;
  v_role   text;
begin
  if not exists (select 1 from public.groups g where g.id = p_group_id and g.is_public) then
    raise exception 'This group is private. Ask for an invite code.';
  end if;
  if exists (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = v_user) then
    return p_group_id; -- already a member
  end if;
  -- The last time you left this group: was it an admin who removed you?
  if (select l.actor_id is distinct from v_user
      from public.audit_log l
      where l.group_id = p_group_id and l.action = 'member_removed' and l.details ->> 'user_id' = v_user::text
      order by l.created_at desc
      limit 1) then
    raise exception 'An admin removed you from this group. Ask them for an invite code.';
  end if;

  select p.id into v_player from public.players p where p.group_id = p_group_id and p.user_id = v_user;
  if v_player is null then
    insert into public.players (group_id, user_id, display_name)
    values (p_group_id, v_user, public.clean_name(coalesce(
      nullif(trim(p_display_name), ''),
      (select a.display_name from public.profiles a where a.id = v_user)
    )))
    returning id into v_player;
  end if;

  v_role := case
    when exists (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.role = 'admin')
    then 'member' else 'admin'
  end;
  insert into public.group_members (group_id, user_id, player_id, role)
  values (p_group_id, v_user, v_player, v_role);

  insert into public.rating_config (group_id) values (p_group_id) on conflict do nothing;
  perform public.write_audit(p_group_id, 'member_joined',
    jsonb_build_object('player_id', v_player, 'role', v_role, 'public', true));
  return p_group_id;
end;
$$;

revoke execute on function
  public.is_group_admin_folder(text),
  public.get_account(uuid),
  public.list_public_groups(),
  public.join_public_group(uuid, text)
from public, anon, authenticated;

grant execute on function
  -- used inside the storage rules
  public.is_group_admin_folder(text),
  -- app actions
  public.get_account(uuid),
  public.list_public_groups(),
  public.join_public_group(uuid, text)
to authenticated;


-- -----------------------------------------------------------------------------
-- 3. The group chat
-- -----------------------------------------------------------------------------
create table public.group_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  -- The author's player in this group (their name and photo there).
  player_id  uuid not null references public.players (id) on delete cascade,
  user_id    uuid references public.profiles (id) on delete set null,
  -- Text only, 1 to 500 characters. Deleting blanks it (deleted_at is set).
  body       text check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint group_messages_deleted_check check ((deleted_at is null) = (body is not null))
);

create index group_messages_group_idx on public.group_messages (group_id, created_at desc);

alter table public.group_messages enable row level security;
create policy "members read their group's chat" on public.group_messages
  for select to authenticated using (public.is_group_member(group_id));

-- Read by members (RLS above); written only through the functions below.
revoke all on public.group_messages from anon, authenticated;
grant select on public.group_messages to authenticated;
grant all on public.group_messages to service_role;

-- New and deleted messages reach open apps straight away (Supabase Realtime).
-- Every Supabase project has this publication; the check keeps other
-- databases (the tests' stand-in) working without it.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.group_messages;
  end if;
end;
$$;

create function public.send_message(p_group_id uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid := public.require_member(p_group_id);
  v_body   text := regexp_replace(coalesce(p_body, ''), '^\s+|\s+$', '', 'g');
  v_id     uuid;
begin
  if v_body = '' then
    raise exception 'Type a message first.';
  end if;
  if char_length(v_body) > 500 then
    raise exception 'Messages can be up to 500 characters.';
  end if;
  insert into public.group_messages (group_id, player_id, user_id, body)
  values (p_group_id, v_player, auth.uid(), v_body)
  returning id into v_id;
  return v_id;
end;
$$;

-- Your own messages, or anyone's if you're an admin (that one goes in the
-- change history). The text is removed; "Message deleted" stays in its place.
create function public.delete_message(p_message_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_message public.group_messages;
  v_me      uuid;
begin
  select * into v_message from public.group_messages where id = p_message_id;
  if not found or not public.is_group_member(v_message.group_id) then
    raise exception 'Message not found.';
  end if;
  v_me := public.require_member(v_message.group_id);
  if v_message.player_id <> v_me then
    perform public.require_admin(v_message.group_id);
    perform public.write_audit(v_message.group_id, 'message_deleted',
      jsonb_build_object('player_id', v_message.player_id));
  end if;
  update public.group_messages set body = null, deleted_at = now()
  where id = p_message_id and deleted_at is null;
end;
$$;

revoke execute on function
  public.send_message(uuid, text),
  public.delete_message(uuid)
from public, anon, authenticated;

grant execute on function
  public.send_message(uuid, text),
  public.delete_message(uuid)
to authenticated;


-- -----------------------------------------------------------------------------
-- 4. The pitch: a Google Maps link and its map position
-- -----------------------------------------------------------------------------
alter table public.matches
  add column pitch_url text
    constraint matches_pitch_url_check check (char_length(pitch_url) <= 500 and pitch_url ~ '^https://'),
  add column pitch_lat double precision
    constraint matches_pitch_lat_check check (pitch_lat between -90 and 90),
  add column pitch_lng double precision
    constraint matches_pitch_lng_check check (pitch_lng between -180 and 180),
  -- Both or neither, and only with a link.
  add constraint matches_pitch_position_check
    check ((pitch_lat is null) = (pitch_lng is null) and (pitch_lat is null or pitch_url is not null));

-- File 4's write_night_details, now also with the pitch link:
-- p_night also takes "pitch_url": "https://maps.app.goo.gl/...", "pitch_lat": 30.0444, "pitch_lng": 31.2357
-- (the app finds the position in the link; null when it can't).
create or replace function public.write_night_details(p_match_id uuid, p_group_id uuid, p_night jsonb)
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
  v_url       text := nullif(trim(v_night ->> 'pitch_url'), '');
  v_lat       double precision := (v_night ->> 'pitch_lat')::double precision;
  v_lng       double precision := (v_night ->> 'pitch_lng')::double precision;
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
  if v_url is not null and (char_length(v_url) > 500 or v_url !~ '^https://') then
    raise exception 'Paste a Google Maps link.';
  end if;
  -- No link, no position.
  if v_url is null then
    v_lat := null;
    v_lng := null;
  end if;
  if (v_lat is null) <> (v_lng is null) or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
    raise exception 'That map position is not valid.';
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
      player_cap          = v_cap,
      pitch_url           = v_url,
      pitch_lat           = v_lat,
      pitch_lng           = v_lng
  where id = p_match_id;
end;
$$;

-- write_night_details stays internal ("create or replace" keeps its
-- permissions from file 4). The service role keeps everything.
grant execute on all functions in schema public to service_role;
