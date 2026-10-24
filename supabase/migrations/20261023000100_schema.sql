-- =============================================================================
-- 7GZ-KORA: database schema (file 1 of 4)
--
-- Tables, helper functions and Row Level Security (RLS).
-- Run the files in supabase/migrations in order (1 to 4) in the Supabase
-- SQL Editor, or with `npx supabase db push`.
--
-- Key idea: stats attach to a PLAYER, not directly to a user account.
-- A player is usually linked to a user, but may have none (seeded players
-- now, guests later). That way guests need no changes to the stats tables.
--
-- Security model:
--   * Every table has RLS. You can only READ rows of groups you belong to.
--   * Almost all WRITES go through the functions in file 3 (create_group,
--     log_goal, submit_votes, ...). Those functions check who you are and
--     what you are allowed to do, then write. Direct table writes are only
--     allowed for a few simple columns (see the grants at the end of file 3).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Profiles: one row per signed-in account (filled automatically on sign-up)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text not null default '',
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Copy name and photo from the Google account when someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- Groups, players and members
-- -----------------------------------------------------------------------------
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  -- Short code friends type to join, e.g. KICK-7Q3F. NULL = invites disabled.
  invite_code text unique,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.players (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  -- NULL for players without an account (seed data now, guests later).
  user_id      uuid references public.profiles (id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 40),
  is_guest     boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (group_id, user_id)
);

create table public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  role      text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index players_group_idx on public.players (group_id);
create index group_members_user_idx on public.group_members (user_id);


-- -----------------------------------------------------------------------------
-- Nights, check-in and stints (lineups)
-- -----------------------------------------------------------------------------
-- A night is one pitch booking (about 2 hours). Only the screens say "night";
-- in the database a night is a row in matches.
create table public.matches (
  id                  uuid primary key default gen_random_uuid(),
  group_id            uuid not null references public.groups (id) on delete cascade,
  -- The night's date. The season is the calendar year of this date.
  played_at           date not null default current_date,
  -- Planned start time (check-in times are compared with it later, for lateness).
  starts_at           timestamptz,
  -- The pitch: a name or a place.
  location            text check (char_length(location) <= 80),
  duration_minutes    int not null default 120 check (duration_minutes between 15 and 600),
  -- Total pitch cost, split equally among everyone checked in (file 4: night_payer_rows).
  cost                numeric not null default 0 check (cost between 0 and 100000),
  currency            text not null default 'EGP',
  -- Everyone pays their share to this player, who pays the pitch owner.
  collector_player_id uuid references public.players (id) on delete set null,
  players_per_side    int not null default 6 check (players_per_side between 5 and 11),
  -- Default game length in minutes (a guide for the timer in stage 2).
  game_minutes        int not null default 10 check (game_minutes between 1 and 120),
  -- "I'm in" beyond this many puts people on the waiting list. NULL = no limit.
  player_cap          int check (player_cap between 2 and 100),
  -- draft:     planned; players reply "I'm in" or "Out"
  -- playing:   the night is on: check-in, teams, goals
  -- voting:    the night is over, players are voting
  -- closed:    voting over, ratings are final
  -- cancelled: called off; nothing counts (no votes, no ratings)
  status              text not null default 'draft'
                      check (status in ('draft', 'playing', 'voting', 'closed', 'cancelled')),
  voting_closes_at    timestamptz,
  closed_at           timestamptz,
  cancel_reason       text check (cancel_reason in ('rain', 'not_enough_players', 'pitch_problem', 'other')),
  cancel_note         text check (char_length(cancel_note) <= 200),
  -- What the pitch still charges for a cancelled night (a lost deposit or fee).
  cancel_fee          numeric not null default 0 check (cancel_fee >= 0),
  cancelled_at        timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now()
);

create index matches_group_idx on public.matches (group_id, played_at desc);

-- Who was checked in at the pitch: they play, vote and pay. Votes and goals
-- can only reference players listed here.
create table public.match_players (
  match_id   uuid not null references public.matches (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  arrived_at timestamptz not null default now(),
  -- Set when someone leaves early. They still count for the night (and the money).
  left_at    timestamptz,
  primary key (match_id, player_id)
);

-- A stint is a period of the match with fixed lineups. Every match has at
-- least one. The v1 screens only ever create one stint (weight 1), but the
-- rating calculation already handles several, so "Lineup changed" (phase 2)
-- is only a UI addition.
create table public.stints (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  ordinal    int not null default 1,
  -- Share of the match. The rating calculation divides by the sum of all
  -- weights, so equal weights (e.g. 1 and 1) mean an equal split.
  weight     numeric not null default 1 check (weight > 0),
  created_at timestamptz not null default now(),
  unique (match_id, ordinal),
  unique (id, match_id)
);

create table public.stint_players (
  stint_id      uuid not null,
  match_id      uuid not null,
  player_id     uuid not null,
  team          text not null check (team in ('A', 'B')),
  is_goalkeeper boolean not null default false,
  primary key (stint_id, player_id),
  foreign key (stint_id, match_id) references public.stints (id, match_id) on delete cascade,
  foreign key (match_id, player_id) references public.match_players (match_id, player_id) on delete cascade
);

-- At most one goalkeeper per team per stint.
create unique index stint_players_one_gk on public.stint_players (stint_id, team) where is_goalkeeper;


-- -----------------------------------------------------------------------------
-- Goals and saves
-- -----------------------------------------------------------------------------
create table public.goals (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches (id) on delete cascade,
  stint_id     uuid not null,
  scoring_team text not null check (scoring_team in ('A', 'B')),
  scorer_id    uuid not null,
  assister_id  uuid,
  -- Confirmed by the other player involved (or an admin). Unconfirmed goals
  -- still count; they auto-confirm when voting closes unless disputed.
  confirmed    boolean not null default false,
  -- Disputed goals do NOT count until an admin edits (or deletes) them.
  disputed     boolean not null default false,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  check (assister_id is null or assister_id <> scorer_id),
  foreign key (stint_id, match_id) references public.stints (id, match_id) on delete cascade,
  foreign key (match_id, scorer_id) references public.match_players (match_id, player_id),
  foreign key (match_id, assister_id) references public.match_players (match_id, player_id)
);

create index goals_match_idx on public.goals (match_id);

-- Optional feature (phase 3). The rating calculation already counts saves.
create table public.saves (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references public.matches (id) on delete cascade,
  stint_id      uuid not null,
  goalkeeper_id uuid not null,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  foreign key (stint_id, match_id) references public.stints (id, match_id) on delete cascade,
  foreign key (match_id, goalkeeper_id) references public.match_players (match_id, player_id)
);


-- -----------------------------------------------------------------------------
-- Votes
-- -----------------------------------------------------------------------------
create table public.ratings_votes (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  voter_id   uuid not null,
  target_id  uuid not null,
  score      smallint check (score between 1 and 10),
  didnt_see  boolean not null default false,
  comment    text check (char_length(comment) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, voter_id, target_id),
  check (voter_id <> target_id),
  -- Either a score, or "didn't see enough", never both.
  check ((didnt_see and score is null) or (not didnt_see and score is not null)),
  -- Voter and target must both have played in the match.
  foreign key (match_id, voter_id) references public.match_players (match_id, player_id) on delete cascade,
  foreign key (match_id, target_id) references public.match_players (match_id, player_id) on delete cascade
);

create table public.mvp_votes (
  match_id  uuid not null references public.matches (id) on delete cascade,
  voter_id  uuid not null,
  target_id uuid not null,
  primary key (match_id, voter_id),
  check (voter_id <> target_id),
  foreign key (match_id, voter_id) references public.match_players (match_id, player_id) on delete cascade,
  foreign key (match_id, target_id) references public.match_players (match_id, player_id) on delete cascade
);

-- Fun votes (phase 3). Table exists now so the data model is complete.
create table public.extra_votes (
  match_id  uuid not null references public.matches (id) on delete cascade,
  voter_id  uuid not null,
  target_id uuid not null,
  kind      text not null check (kind in ('best_goal', 'worst_miss', 'best_save', 'fair_play')),
  primary key (match_id, voter_id, kind),
  foreign key (match_id, voter_id) references public.match_players (match_id, player_id) on delete cascade,
  foreign key (match_id, target_id) references public.match_players (match_id, player_id) on delete cascade
);


-- -----------------------------------------------------------------------------
-- Replies ("I'm in" / "Out") and rent payments
-- -----------------------------------------------------------------------------
-- One reply per player per planned night. Who actually came is match_players.
create table public.rsvps (
  match_id          uuid not null references public.matches (id) on delete cascade,
  player_id         uuid not null references public.players (id) on delete cascade,
  -- in: coming · waiting: on the waiting list (the night was full) · out: not coming
  status            text not null check (status in ('in', 'waiting', 'out')),
  -- When the status last changed (for "late cancel" in the punishments stage).
  status_changed_at timestamptz not null default now(),
  -- Place on the waiting list: when they tapped "I'm in" on a full night.
  waiting_since     timestamptz,
  -- When they moved up from the waiting list ("You're in!").
  promoted_at       timestamptz,
  -- On an "out": the waiting-list player who took this spot, if anyone did.
  spot_taken_by     uuid,
  primary key (match_id, player_id)
);

-- A tick per player who has paid their share back to the night's collector.
create table public.night_payments (
  match_id  uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  paid_at   timestamptz not null default now(),
  -- Who ticked it (the collector or an admin).
  marked_by uuid references public.profiles (id) on delete set null,
  primary key (match_id, player_id)
);


-- -----------------------------------------------------------------------------
-- Audit log: a simple record of edits (goal changes, lineup changes, ...)
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  details    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_group_idx on public.audit_log (group_id, created_at desc);


-- -----------------------------------------------------------------------------
-- Helper functions used by the RLS policies.
-- "security definer" lets them look at group_members without running into
-- RLS themselves (which would otherwise loop forever).
-- -----------------------------------------------------------------------------
create function public.is_group_member(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = auth.uid()
  );
$$;

create function public.is_group_admin(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = auth.uid() and gm.role = 'admin'
  );
$$;

-- The current user's player in a group (NULL if not a member).
create function public.my_player_id(p_group_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select gm.player_id from public.group_members gm
  where gm.group_id = p_group_id and gm.user_id = auth.uid();
$$;

create function public.match_group_id(p_match_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.group_id from public.matches m where m.id = p_match_id;
$$;

-- Votes are secret until voting closes. A vote is visible if you cast it,
-- or if the match is closed.
create function public.can_see_vote(p_match_id uuid, p_voter_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    join public.group_members gm on gm.group_id = m.group_id and gm.user_id = auth.uid()
    where m.id = p_match_id
      and (m.status = 'closed' or gm.player_id = p_voter_id)
  );
$$;


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.players       enable row level security;
alter table public.group_members enable row level security;
alter table public.matches       enable row level security;
alter table public.match_players enable row level security;
alter table public.rsvps          enable row level security;
alter table public.night_payments enable row level security;
alter table public.stints        enable row level security;
alter table public.stint_players enable row level security;
alter table public.goals         enable row level security;
alter table public.saves         enable row level security;
alter table public.ratings_votes enable row level security;
alter table public.mvp_votes     enable row level security;
alter table public.extra_votes   enable row level security;
alter table public.audit_log     enable row level security;

-- You can see your own profile and the profiles of people in your groups.
create policy "read own and group mates' profiles" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.group_members me
      join public.group_members them on them.group_id = me.group_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );

create policy "members read their groups" on public.groups
  for select to authenticated using (public.is_group_member(id));
create policy "admins rename their groups" on public.groups
  for update to authenticated
  using (public.is_group_admin(id)) with check (public.is_group_admin(id));

create policy "members read players" on public.players
  for select to authenticated using (public.is_group_member(group_id));
-- Only display_name can be updated (see column grants in file 3).
create policy "rename yourself, or anyone if admin" on public.players
  for update to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id))
  with check (user_id = auth.uid() or public.is_group_admin(group_id));

create policy "members read members" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));

create policy "members read matches" on public.matches
  for select to authenticated using (public.is_group_member(group_id));

create policy "members read attendance" on public.match_players
  for select to authenticated using (public.is_group_member(public.match_group_id(match_id)));
create policy "members read stints" on public.stints
  for select to authenticated using (public.is_group_member(public.match_group_id(match_id)));
create policy "members read lineups" on public.stint_players
  for select to authenticated using (public.is_group_member(public.match_group_id(match_id)));
create policy "members read goals" on public.goals
  for select to authenticated using (public.is_group_member(public.match_group_id(match_id)));
create policy "members read saves" on public.saves
  for select to authenticated using (public.is_group_member(public.match_group_id(match_id)));
create policy "members read replies" on public.rsvps
  for select to authenticated using (public.is_group_member(public.match_group_id(match_id)));
create policy "members read payments" on public.night_payments
  for select to authenticated using (public.is_group_member(public.match_group_id(match_id)));

create policy "own votes, or all once closed" on public.ratings_votes
  for select to authenticated using (public.can_see_vote(match_id, voter_id));
create policy "own MVP vote, or all once closed" on public.mvp_votes
  for select to authenticated using (public.can_see_vote(match_id, voter_id));
create policy "own fun votes, or all once closed" on public.extra_votes
  for select to authenticated using (public.can_see_vote(match_id, voter_id));

create policy "members read the audit log" on public.audit_log
  for select to authenticated using (public.is_group_member(group_id));
