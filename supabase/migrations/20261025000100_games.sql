-- =============================================================================
-- 7GZ-KORA: games (file 5 of 5)
--
-- Many short games in a night (Plans/Football-scenario.md sections 2, 3 and
-- 6; Plans/Extras-and-backlog.md sections 3 and 4): the team board (Team A,
-- B, C and the bench), games with a timer, swaps, penalties, admin-only
-- goals, minutes played and in goal, and one rating per night from all its
-- games.
--
-- Files 1 to 4 already run on the live project, so this file only adds to
-- them: new tables and columns, replaced functions, and the old nights moved
-- over (each becomes one game). Run it once, in the SQL Editor, when no night
-- is in progress.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- The team board, games and lineup periods
-- -----------------------------------------------------------------------------

-- The team board: the team each checked-in player is on right now.
-- NULL = on the bench (a sub).
alter table public.match_players
  add column team text check (team in ('A', 'B', 'C'));

-- Suggested first when a game needs a goalkeeper (Extras section 3).
alter table public.players
  add column happy_in_goal boolean not null default false;

-- A game: two of the night's teams, a timer, and a score from its goals.
create table public.games (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null,
  ordinal         int not null,
  team_one        text not null check (team_one in ('A', 'B', 'C')),
  team_two        text not null check (team_two in ('A', 'B', 'C')),
  -- A guide for the timer (the night's game length): it buzzes, but only an
  -- admin ends the game.
  planned_minutes int not null check (planned_minutes between 1 and 600),
  started_at      timestamptz not null default now(),
  -- NULL while the game is on.
  ended_at        timestamptz,
  -- A draw with a team waiting: who won the shootout. It only decides who
  -- stays on; for ratings the game is still a draw.
  penalty_winner  text,
  created_at      timestamptz not null default now(),
  constraint games_match_id_fkey foreign key (match_id) references public.matches (id) on delete cascade,
  unique (match_id, ordinal),
  unique (id, match_id),
  check (team_one <> team_two),
  check (penalty_winner is null or penalty_winner in (team_one, team_two)),
  check (ended_at is null or ended_at >= started_at)
);

-- At most one game in progress per night.
create unique index games_one_running on public.games (match_id) where ended_at is null;

-- Lineup periods (stints) belong to a game and have real start and end
-- times: minutes come from the times. NULL ended_at = still on the pitch.
alter table public.stints
  add column game_id    uuid,
  add column started_at timestamptz,
  add column ended_at   timestamptz,
  add constraint stints_game_id_match_id_fkey
    foreign key (game_id, match_id) references public.games (id, match_id) on delete cascade,
  add constraint stints_id_game_id_key unique (id, game_id);

-- Team C plays too.
alter table public.stint_players drop constraint stint_players_team_check;
alter table public.stint_players add constraint stint_players_team_check check (team in ('A', 'B', 'C'));
alter table public.goals drop constraint goals_scoring_team_check;
alter table public.goals add constraint goals_scoring_team_check check (scoring_team in ('A', 'B', 'C'));

-- Each goal belongs to a game: the game of its lineup period.
alter table public.goals
  add column game_id uuid,
  add constraint goals_stint_id_game_id_fkey
    foreign key (stint_id, game_id) references public.stints (id, game_id) on delete cascade;

create index goals_game_idx on public.goals (game_id);

-- Minutes on the pitch and in goal, stored with each night's rating.
alter table public.match_ratings
  add column minutes_played  numeric not null default 0,
  add column minutes_in_goal numeric not null default 0;

-- Row Level Security and permissions for the new table. Supabase would
-- otherwise let anyone write to it directly.
alter table public.games enable row level security;
create policy "members read games" on public.games
  for select to authenticated using (public.is_group_member(public.match_group_id(match_id)));

revoke all on public.games from anon, authenticated;
grant select on public.games to authenticated;
grant all on public.games to service_role;
-- Players say for themselves whether they're happy in goal (admins can for
-- anyone), under the same row rule as renaming (file 1).
grant update (happy_in_goal) on public.players to authenticated;


-- -----------------------------------------------------------------------------
-- Moving the old nights over
-- -----------------------------------------------------------------------------

-- Ratings already stored must not be recalculated, so the triggers that
-- recalculate a closed night when its lineups or goals change (file 2) are
-- off while the rows move.
alter table public.stints disable trigger stints_recompute;
alter table public.goals disable trigger goals_recompute;

-- Each night that already has lineups becomes one game between Team A and
-- Team B, lasting the whole booking.
insert into public.games (match_id, ordinal, team_one, team_two, planned_minutes, started_at, ended_at)
select m.id, 1, 'A', 'B', m.duration_minutes,
       coalesce(m.starts_at, m.created_at),
       coalesce(m.starts_at, m.created_at) + make_interval(mins => m.duration_minutes)
from public.matches m
where exists (select 1 from public.stints s where s.match_id = m.id);

-- Its lineup periods share that time in order, by their old weights.
update public.stints s
set game_id    = p.game_id,
    started_at = p.game_start + p.game_length * (p.weight_before / p.weight_total)::float8,
    ended_at   = p.game_start + p.game_length * ((p.weight_before + s.weight) / p.weight_total)::float8
from (
  select s2.id,
         g.id as game_id,
         g.started_at as game_start,
         g.ended_at - g.started_at as game_length,
         coalesce(sum(s2.weight) over (partition by s2.match_id order by s2.ordinal
                                       rows between unbounded preceding and 1 preceding), 0) as weight_before,
         sum(s2.weight) over (partition by s2.match_id) as weight_total
  from public.stints s2
  join public.games g on g.match_id = s2.match_id
) p
where p.id = s.id;

update public.goals g
set game_id = s.game_id
from public.stints s
where s.id = g.stint_id;

alter table public.stints enable trigger stints_recompute;
alter table public.goals enable trigger goals_recompute;

-- The team board shows each player's team in the night's last lineup.
update public.match_players mp
set team = sp.team
from public.stint_players sp
join public.stints s on s.id = sp.stint_id
where sp.match_id = mp.match_id
  and sp.player_id = mp.player_id
  and s.ordinal = (select max(s2.ordinal) from public.stints s2 where s2.match_id = mp.match_id);

-- Ratings already stored stay as they are; only their minutes are filled in.
update public.match_ratings mr
set minutes_played  = m.played,
    minutes_in_goal = m.in_goal
from (
  select sp.match_id,
         sp.player_id,
         sum(extract(epoch from s.ended_at - s.started_at) / 60) as played,
         coalesce(sum(extract(epoch from s.ended_at - s.started_at) / 60) filter (where sp.is_goalkeeper), 0) as in_goal
  from public.stint_players sp
  join public.stints s on s.id = sp.stint_id
  group by sp.match_id, sp.player_id
) m
where mr.match_id = m.match_id and mr.player_id = m.player_id;

-- clean_sheet_min_share is replaced by clean_sheet_min_minutes (below).
update public.rating_config set points = points - 'clean_sheet_min_share';


-- Everything has moved over: from now on every lineup period belongs to a
-- game and has a start time, and every goal belongs to a game. The old
-- weights are gone: minutes come from the times.
alter table public.stints
  alter column game_id set not null,
  alter column started_at set not null,
  alter column started_at set default now(),
  drop column weight;
alter table public.goals
  alter column game_id set not null;


-- -----------------------------------------------------------------------------
-- Ratings: one per player per night, from all its games
-- (Plans/Football-scenario.md section 3). These replace the versions in file 2.
-- -----------------------------------------------------------------------------

-- DEFAULT POINTS. clean_sheet_min_minutes replaces clean_sheet_min_share: a
-- clean sheet needs a whole game in goal lasting at least this many minutes.
create or replace function public.rating_points_defaults()
returns jsonb
language sql immutable set search_path = ''
as $$
  select '{
    "base": 5.0,

    "goal": 1.0,
    "goal_cap": 3.5,

    "assist": 0.7,
    "assist_cap": 2.0,

    "net_goal": 0.25,
    "net_goal_min": -1.5,
    "net_goal_max": 1.5,

    "win": 0.5,
    "draw": 0.0,
    "loss": -0.5,

    "clean_sheet": 0.5,
    "clean_sheet_cap": 1.0,
    "clean_sheet_min_minutes": 8,

    "save": 0.15,
    "save_cap": 1.0,

    "analytics_min": 1.0,
    "analytics_max": 10.0
  }'::jsonb;
$$;

-- compute_match_ratings: THE rating calculation, still the one place.
-- For a night, over all its games:
--   * team impact = the plain SUM of goal difference while on the pitch, over
--     every lineup period played. (Phase 1 weighted it by stint: that was a bug.)
--   * result      = your team's final result in each game (win, draw or loss;
--     a draw decided on penalties is a draw), averaged over your minutes.
--   * clean sheet = in goal for the same team in every period of a game that
--     lasted at least clean_sheet_min_minutes, with nothing conceded in it.
-- Deletes and rewrites match_ratings for the night. Safe to run any number of
-- times; it always gives the same answer for the same data.
create or replace function public.compute_match_ratings(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.rating_config%rowtype;
  pts jsonb;
  v_base           numeric;
  v_goal           numeric;
  v_goal_cap       numeric;
  v_assist         numeric;
  v_assist_cap     numeric;
  v_net_goal       numeric;
  v_net_min        numeric;
  v_net_max        numeric;
  v_win            numeric;
  v_draw           numeric;
  v_loss           numeric;
  v_cs             numeric;
  v_cs_cap         numeric;
  v_cs_min_minutes numeric;
  v_save           numeric;
  v_save_cap       numeric;
  v_min            numeric;
  v_max            numeric;
begin
  -- Lock the night so two recalculations of it cannot clash.
  perform 1 from public.matches m where m.id = p_match_id for update;

  -- Make sure the group has a config row, then load it.
  insert into public.rating_config (group_id)
  select m.group_id from public.matches m where m.id = p_match_id
  on conflict (group_id) do nothing;

  select rc.* into cfg
  from public.rating_config rc
  join public.matches m on m.group_id = rc.group_id
  where m.id = p_match_id;

  if not found then
    raise exception 'Match % not found', p_match_id;
  end if;

  pts              := public.rating_points_defaults() || coalesce(cfg.points, '{}'::jsonb);
  v_base           := (pts ->> 'base')::numeric;
  v_goal           := (pts ->> 'goal')::numeric;
  v_goal_cap       := (pts ->> 'goal_cap')::numeric;
  v_assist         := (pts ->> 'assist')::numeric;
  v_assist_cap     := (pts ->> 'assist_cap')::numeric;
  v_net_goal       := (pts ->> 'net_goal')::numeric;
  v_net_min        := (pts ->> 'net_goal_min')::numeric;
  v_net_max        := (pts ->> 'net_goal_max')::numeric;
  v_win            := (pts ->> 'win')::numeric;
  v_draw           := (pts ->> 'draw')::numeric;
  v_loss           := (pts ->> 'loss')::numeric;
  v_cs             := (pts ->> 'clean_sheet')::numeric;
  v_cs_cap         := (pts ->> 'clean_sheet_cap')::numeric;
  v_cs_min_minutes := (pts ->> 'clean_sheet_min_minutes')::numeric;
  v_save           := (pts ->> 'save')::numeric;
  v_save_cap       := (pts ->> 'save_cap')::numeric;
  v_min            := (pts ->> 'analytics_min')::numeric;
  v_max            := (pts ->> 'analytics_max')::numeric;

  delete from public.match_ratings where match_id = p_match_id;

  insert into public.match_ratings (
    match_id, player_id, analytics_score, vote_average, vote_count, stats_only,
    final_rating, goals, assists, clean_sheets, saves, mvp_votes, is_mvp,
    minutes_played, minutes_in_goal, breakdown
  )
  with
  -- Goals that count: everything except disputed goals.
  counted_goals as (
    select g.* from public.goals g
    where g.match_id = p_match_id and not g.disputed
  ),
  -- Each lineup period and its length in minutes (one still going counts up to now).
  periods as (
    select s.id as stint_id,
           s.game_id,
           greatest(extract(epoch from coalesce(s.ended_at, now()) - s.started_at) / 60, 0) as minutes
    from public.stints s
    where s.match_id = p_match_id
  ),
  -- Each game's final score and length. Shootout goals are never recorded.
  game_scores as (
    select g.id as game_id,
           g.team_one,
           g.team_two,
           (select count(*) from counted_goals cg where cg.game_id = g.id and cg.scoring_team = g.team_one) as goals_one,
           (select count(*) from counted_goals cg where cg.game_id = g.id and cg.scoring_team = g.team_two) as goals_two,
           (select coalesce(sum(p.minutes), 0) from periods p where p.game_id = g.id) as minutes,
           (select count(*) from periods p where p.game_id = g.id) as period_count
    from public.games g
    where g.match_id = p_match_id
  ),
  -- One row per player per period on the pitch: the goal difference in that
  -- period, and their team's final goal difference in that game.
  player_periods as (
    select sp.player_id,
           sp.team,
           sp.is_goalkeeper,
           p.game_id,
           p.minutes,
           (select count(*) filter (where cg.scoring_team = sp.team)
                   - count(*) filter (where cg.scoring_team <> sp.team)
              from counted_goals cg where cg.stint_id = p.stint_id) as net,
           case when sp.team = gs.team_one then gs.goals_one - gs.goals_two
                else gs.goals_two - gs.goals_one end as game_diff
    from public.stint_players sp
    join periods p on p.stint_id = sp.stint_id
    join game_scores gs on gs.game_id = p.game_id
  ),
  -- Team impact: the plain sum. Result: averaged over minutes on the pitch.
  team_impact as (
    select pp.player_id,
           sum(pp.net) as net_goals,
           sum(pp.minutes) as minutes_played,
           coalesce(sum(pp.minutes) filter (where pp.is_goalkeeper), 0) as minutes_in_goal,
           case when sum(pp.minutes) > 0
                then sum(pp.minutes * case when pp.game_diff > 0 then v_win
                                           when pp.game_diff < 0 then v_loss
                                           else v_draw end) / sum(pp.minutes)
                else 0
           end as result_points
    from player_periods pp
    group by pp.player_id
  ),
  -- Clean sheets: a whole game in goal for one team, long enough, nothing conceded.
  clean_sheets as (
    select k.player_id, count(*) as n
    from (
      select pp.player_id, pp.game_id, pp.team, count(*) as periods_in_goal
      from player_periods pp
      where pp.is_goalkeeper
      group by pp.player_id, pp.game_id, pp.team
    ) k
    join game_scores gs on gs.game_id = k.game_id
    where k.periods_in_goal = gs.period_count
      and gs.minutes >= v_cs_min_minutes
      and (case when k.team = gs.team_one then gs.goals_two else gs.goals_one end) = 0
    group by k.player_id
  ),
  -- Peer votes. "Didn't see enough" has no score, so it is not counted.
  votes as (
    select rv.target_id as player_id, avg(rv.score) as vote_average, count(*) as vote_count
    from public.ratings_votes rv
    where rv.match_id = p_match_id and rv.score is not null
    group by rv.target_id
  ),
  mvp as (
    select mv.target_id as player_id, count(*) as n
    from public.mvp_votes mv
    where mv.match_id = p_match_id
    group by mv.target_id
  ),
  -- Everyone checked in gets a rating, even if they never got on the pitch.
  stats as (
    select mp.player_id,
           (select count(*) from counted_goals g where g.scorer_id = mp.player_id) as goals,
           (select count(*) from counted_goals g where g.assister_id = mp.player_id) as assists,
           (select count(*) from public.saves sv
             where sv.match_id = p_match_id and sv.goalkeeper_id = mp.player_id) as saves,
           coalesce(t.net_goals, 0) as net_goals,
           coalesce(t.result_points, 0) as result_points,
           coalesce(t.minutes_played, 0) as minutes_played,
           coalesce(t.minutes_in_goal, 0) as minutes_in_goal,
           coalesce(cs.n, 0) as clean_sheets,
           v.vote_average,
           coalesce(v.vote_count, 0) as vote_count,
           coalesce(mv.n, 0) as mvp_votes
    from public.match_players mp
    left join team_impact t on t.player_id = mp.player_id
    left join clean_sheets cs on cs.player_id = mp.player_id
    left join votes v on v.player_id = mp.player_id
    left join mvp mv on mv.player_id = mp.player_id
    where mp.match_id = p_match_id
  ),
  -- Points for each component, with caps applied.
  points as (
    select s.*,
           least(s.goals * v_goal, v_goal_cap) as goal_pts,
           least(s.assists * v_assist, v_assist_cap) as assist_pts,
           greatest(v_net_min, least(v_net_max, s.net_goals * v_net_goal)) as net_pts,
           s.result_points as result_pts,
           least(s.clean_sheets * v_cs, v_cs_cap) as cs_pts,
           least(s.saves * v_save, v_save_cap) as save_pts
    from stats s
  ),
  scored as (
    select p.*,
           greatest(v_min, least(v_max,
             v_base + p.goal_pts + p.assist_pts + p.net_pts + p.result_pts + p.cs_pts + p.save_pts
           )) as analytics,
           p.vote_count < cfg.min_votes as stats_only
    from points p
  ),
  rated as (
    select s.*,
           case when s.stats_only then s.analytics
                else cfg.w_analytics * s.analytics + cfg.w_votes * s.vote_average
           end as final_rating,
           s.mvp_votes > 0 and s.mvp_votes = max(s.mvp_votes) over () as is_mvp
    from scored s
  )
  select p_match_id,
         f.player_id,
         f.analytics,
         f.vote_average,
         f.vote_count,
         f.stats_only,
         f.final_rating,
         f.goals,
         f.assists,
         f.clean_sheets,
         f.saves,
         f.mvp_votes,
         f.is_mvp,
         f.minutes_played,
         f.minutes_in_goal,
         jsonb_build_object(
           'base',          v_base,
           'goals',         round(f.goal_pts, 2),
           'assists',       round(f.assist_pts, 2),
           'net_goals',     round(f.net_pts, 2),
           'net_goal_diff', f.net_goals,
           'result',        round(f.result_pts, 2),
           'clean_sheets',  round(f.cs_pts, 2),
           'saves',         round(f.save_pts, 2),
           'minutes',       round(f.minutes_played, 1),
           'analytics',     round(f.analytics, 2),
           'vote_average',  round(f.vote_average, 2),
           'vote_count',    f.vote_count,
           'stats_only',    f.stats_only,
           'w_analytics',   cfg.w_analytics,
           'w_votes',       cfg.w_votes,
           'min_votes',     cfg.min_votes,
           'final',         round(f.final_rating, 3)
         )
  from rated f;
end;
$$;


-- -----------------------------------------------------------------------------
-- Games at the pitch (admins): the team board, starting and ending games,
-- swaps and subs. Same style as file 3: each action checks who is calling,
-- then writes in one transaction.
-- -----------------------------------------------------------------------------

-- The game in progress (NULL if none).
create function public.running_game(p_match_id uuid)
returns public.games
language sql stable set search_path = ''
as $$
  select g.* from public.games g where g.match_id = p_match_id and g.ended_at is null;
$$;

-- Teams and games only change while the night is on.
create function public.require_night_playing(p_match public.matches)
returns void
language plpgsql stable set search_path = ''
as $$
begin
  case p_match.status
    when 'playing' then null;
    when 'draft' then raise exception 'Start the night first.';
    when 'cancelled' then raise exception 'This night was cancelled.';
    else raise exception 'The night has ended, so teams and games are final.';
  end case;
end;
$$;

-- Checks a lineup for the pitch:
--   [{"player_id": "...", "team": "A", "is_goalkeeper": true}, ...]
-- Both playing teams need a player, each team at most one goalkeeper, and
-- everyone must be checked in and still here.
create function public.check_pitch_lineup(p_match_id uuid, p_teams text[], p_lineup jsonb)
returns void
language plpgsql stable set search_path = ''
as $$
declare
  v_names text;
begin
  if jsonb_typeof(p_lineup) is distinct from 'array' then
    raise exception 'The lineup must be a list of players.';
  end if;
  if (select count(*) from jsonb_array_elements(p_lineup))
     <> (select count(distinct e ->> 'player_id') from jsonb_array_elements(p_lineup) e) then
    raise exception 'A player is listed twice.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_lineup) e
             where coalesce(e ->> 'team', '') <> all (p_teams)) then
    raise exception 'Players on the pitch must be on Team % or Team %.', p_teams[1], p_teams[2];
  end if;
  if exists (select 1 from unnest(p_teams) t
             where not exists (select 1 from jsonb_array_elements(p_lineup) e where e ->> 'team' = t)) then
    raise exception 'Both teams need at least one player.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_lineup) e
             where coalesce((e ->> 'is_goalkeeper')::boolean, false)
             group by e ->> 'team' having count(*) > 1) then
    raise exception 'Only one goalkeeper per team.';
  end if;

  select string_agg(coalesce(p.display_name, 'Unknown player'), ', ') into v_names
  from jsonb_array_elements(p_lineup) e
  left join public.players p on p.id = (e ->> 'player_id')::uuid
  left join public.match_players mp on mp.match_id = p_match_id and mp.player_id = (e ->> 'player_id')::uuid
  where mp.player_id is null or mp.left_at is not null;
  if v_names is not null then
    raise exception 'Check in % first (or tap Back if they left early).', v_names;
  end if;
end;
$$;

-- Starts a lineup period of a game with a lineup already checked.
create function public.start_period(p_match_id uuid, p_game_id uuid, p_lineup jsonb)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_stint uuid;
begin
  insert into public.stints (match_id, game_id, ordinal, started_at)
  select p_match_id, p_game_id, coalesce(max(s.ordinal), 0) + 1, now()
  from public.stints s
  where s.match_id = p_match_id
  returning id into v_stint;

  insert into public.stint_players (stint_id, match_id, player_id, team, is_goalkeeper)
  select v_stint, p_match_id, (e ->> 'player_id')::uuid, e ->> 'team',
         coalesce((e ->> 'is_goalkeeper')::boolean, false)
  from jsonb_array_elements(p_lineup) e;
  return v_stint;
end;
$$;

-- Ends the game in progress and its lineup period (Game over, End night, Cancel night).
create function public.stop_game(p_match_id uuid, p_penalty_winner text)
returns void
language plpgsql set search_path = ''
as $$
begin
  update public.stints set ended_at = now() where match_id = p_match_id and ended_at is null;
  update public.games set ended_at = now(), penalty_winner = p_penalty_winner
  where match_id = p_match_id and ended_at is null;
end;
$$;

-- Sets the team board (admins): Team A, B or C for players checked in;
-- everyone else checked in is on the bench.
--   p_board: [{"player_id": "...", "team": "A"}, {"player_id": "...", "team": null}, ...]
-- While a game is on, players on the pitch keep their team: use Swap.
create function public.set_team_board(p_match_id uuid, p_board jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_board jsonb := coalesce(p_board, '[]'::jsonb);
  v_names text;
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_playing(v_match);
  perform 1 from public.matches m where m.id = p_match_id for update;

  if jsonb_typeof(v_board) <> 'array' then
    raise exception 'The team board must be a list of players.';
  end if;
  if exists (select 1 from jsonb_array_elements(v_board) e
             where e ->> 'team' is not null and e ->> 'team' not in ('A', 'B', 'C')) then
    raise exception 'Teams are A, B or C (or the bench).';
  end if;
  if (select count(*) from jsonb_array_elements(v_board))
     <> (select count(distinct e ->> 'player_id') from jsonb_array_elements(v_board) e) then
    raise exception 'A player is listed twice.';
  end if;

  select string_agg(coalesce(p.display_name, 'Unknown player'), ', ') into v_names
  from jsonb_array_elements(v_board) e
  left join public.players p on p.id = (e ->> 'player_id')::uuid
  where not exists (select 1 from public.match_players mp
                    where mp.match_id = p_match_id and mp.player_id = (e ->> 'player_id')::uuid);
  if v_names is not null then
    raise exception 'Check in % first.', v_names;
  end if;

  select string_agg(p.display_name, ', ') into v_names
  from jsonb_array_elements(v_board) e
  join public.match_players mp on mp.match_id = p_match_id and mp.player_id = (e ->> 'player_id')::uuid
  join public.players p on p.id = mp.player_id
  where mp.left_at is not null and e ->> 'team' is not null;
  if v_names is not null then
    raise exception '% left early. Tap "Back" on the check-in list first.', v_names;
  end if;

  -- Players on the pitch keep their team until the game ends.
  select string_agg(p.display_name, ', ') into v_names
  from public.stint_players sp
  join public.stints s on s.id = sp.stint_id and s.ended_at is null
  join public.players p on p.id = sp.player_id
  where sp.match_id = p_match_id
    and sp.team is distinct from (select e ->> 'team' from jsonb_array_elements(v_board) e
                                  where (e ->> 'player_id')::uuid = sp.player_id);
  if v_names is not null then
    raise exception 'Players on the pitch can only be moved with Swap: %.', v_names;
  end if;

  update public.match_players mp
  set team = (select e ->> 'team' from jsonb_array_elements(v_board) e
              where (e ->> 'player_id')::uuid = mp.player_id)
  where mp.match_id = p_match_id;

  perform public.write_audit(v_match.group_id, 'team_board_changed',
    jsonb_build_object('match_id', p_match_id, 'board', v_board));
end;
$$;

-- Starts a game between two teams from the team board (admins). The timer
-- starts now, set to the night's game length. p_keeper_one and p_keeper_two
-- are the two teams' goalkeepers (or null). Returns the new game's id.
create function public.start_game(p_match_id uuid, p_team_one text, p_team_two text,
                                  p_keeper_one uuid, p_keeper_two uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_match  public.matches := public.load_match(p_match_id);
  v_game   uuid;
  v_lineup jsonb;
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_playing(v_match);
  -- Lock the night so two admins can't start two games at once.
  perform 1 from public.matches m where m.id = p_match_id for update;

  if (public.running_game(p_match_id)).id is not null then
    raise exception 'A game is already on. Tap "Game over" first.';
  end if;
  if p_team_one is null or p_team_two is null or p_team_one = p_team_two
     or p_team_one not in ('A', 'B', 'C') or p_team_two not in ('A', 'B', 'C') then
    raise exception 'Pick two different teams.';
  end if;
  if p_keeper_one is not null and not exists (
       select 1 from public.match_players mp
       where mp.match_id = p_match_id and mp.player_id = p_keeper_one and mp.team = p_team_one) then
    raise exception 'The goalkeeper for Team % must be on Team %.', p_team_one, p_team_one;
  end if;
  if p_keeper_two is not null and not exists (
       select 1 from public.match_players mp
       where mp.match_id = p_match_id and mp.player_id = p_keeper_two and mp.team = p_team_two) then
    raise exception 'The goalkeeper for Team % must be on Team %.', p_team_two, p_team_two;
  end if;

  -- Everyone on the two teams goes on the pitch.
  select coalesce(jsonb_agg(jsonb_build_object(
           'player_id', mp.player_id,
           'team', mp.team,
           'is_goalkeeper', mp.player_id is not distinct from p_keeper_one
                            or mp.player_id is not distinct from p_keeper_two)), '[]'::jsonb)
  into v_lineup
  from public.match_players mp
  where mp.match_id = p_match_id and mp.team in (p_team_one, p_team_two) and mp.left_at is null;

  perform public.check_pitch_lineup(p_match_id, array[p_team_one, p_team_two], v_lineup);

  insert into public.games (match_id, ordinal, team_one, team_two, planned_minutes)
  select p_match_id, coalesce(max(g.ordinal), 0) + 1, p_team_one, p_team_two, v_match.game_minutes
  from public.games g
  where g.match_id = p_match_id
  returning id into v_game;

  perform public.start_period(p_match_id, v_game, v_lineup);
  perform public.write_audit(v_match.group_id, 'game_started',
    jsonb_build_object('match_id', p_match_id, 'game_id', v_game));
  return v_game;
end;
$$;

-- Changes who is on the pitch during a game (admins): a swap between the two
-- teams, a sub coming on (from the bench or the waiting team), or a new
-- goalkeeper. p_lineup is the whole new pitch, like start_game's; anyone
-- taken off goes to the bench.
--   p_continue = true:  "Swap and continue": the same game, the score carries
--                       on, and a new lineup period starts.
--   p_continue = false: "End game and swap": the game ends with its current
--                       score and the next one starts 0-0 with the new teams.
-- Returns the game being played now.
create function public.swap_players(p_match_id uuid, p_lineup jsonb, p_continue boolean)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_game  public.games;
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_playing(v_match);
  perform 1 from public.matches m where m.id = p_match_id for update;

  v_game := public.running_game(p_match_id);
  if v_game.id is null then
    raise exception 'No game is on. Change the team board instead.';
  end if;
  perform public.check_pitch_lineup(p_match_id, array[v_game.team_one, v_game.team_two], p_lineup);

  -- The same players, teams and goalkeepers as now: nothing to do.
  if not exists (
    (select (e ->> 'player_id')::uuid, e ->> 'team', coalesce((e ->> 'is_goalkeeper')::boolean, false)
     from jsonb_array_elements(p_lineup) e)
    except
    (select sp.player_id, sp.team, sp.is_goalkeeper
     from public.stint_players sp join public.stints s on s.id = sp.stint_id
     where s.match_id = p_match_id and s.ended_at is null)
  ) and not exists (
    (select sp.player_id, sp.team, sp.is_goalkeeper
     from public.stint_players sp join public.stints s on s.id = sp.stint_id
     where s.match_id = p_match_id and s.ended_at is null)
    except
    (select (e ->> 'player_id')::uuid, e ->> 'team', coalesce((e ->> 'is_goalkeeper')::boolean, false)
     from jsonb_array_elements(p_lineup) e)
  ) then
    raise exception 'Nothing changed.';
  end if;

  -- The team board follows the pitch: players taken off go to the bench,
  -- and everyone on it takes their new team.
  update public.match_players mp
  set team = null
  where mp.match_id = p_match_id
    and mp.player_id in (select sp.player_id
                         from public.stint_players sp join public.stints s on s.id = sp.stint_id
                         where s.match_id = p_match_id and s.ended_at is null);
  update public.match_players mp
  set team = e ->> 'team'
  from jsonb_array_elements(p_lineup) e
  where mp.match_id = p_match_id and mp.player_id = (e ->> 'player_id')::uuid;

  if coalesce(p_continue, true) then
    update public.stints set ended_at = now() where match_id = p_match_id and ended_at is null;
  else
    perform public.stop_game(p_match_id, null);
    insert into public.games (match_id, ordinal, team_one, team_two, planned_minutes)
    values (p_match_id, v_game.ordinal + 1, v_game.team_one, v_game.team_two, v_game.planned_minutes)
    returning * into v_game;
  end if;
  perform public.start_period(p_match_id, v_game.id, p_lineup);

  perform public.write_audit(v_match.group_id, 'players_swapped', jsonb_build_object(
    'match_id', p_match_id, 'game_id', v_game.id, 'continue', coalesce(p_continue, true), 'lineup', p_lineup));
  return v_game.id;
end;
$$;

-- "Game over" (admins). If it's a draw, p_penalty_winner can say who won the
-- shootout: that only decides who stays on. For ratings the game is still a
-- draw, and shootout goals are never recorded.
create function public.end_game(p_match_id uuid, p_penalty_winner text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_game  public.games;
  v_one   int;
  v_two   int;
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_playing(v_match);
  perform 1 from public.matches m where m.id = p_match_id for update;

  v_game := public.running_game(p_match_id);
  if v_game.id is null then
    raise exception 'No game is on.';
  end if;
  if p_penalty_winner is not null then
    if p_penalty_winner not in (v_game.team_one, v_game.team_two) then
      raise exception 'Pick Team % or Team %.', v_game.team_one, v_game.team_two;
    end if;
    select count(*) filter (where g.scoring_team = v_game.team_one),
           count(*) filter (where g.scoring_team = v_game.team_two)
    into v_one, v_two
    from public.goals g
    where g.game_id = v_game.id and not g.disputed;
    if v_one <> v_two then
      raise exception 'Penalties are only for a draw. It''s % – %.', v_one, v_two;
    end if;
  end if;

  perform public.stop_game(p_match_id, p_penalty_winner);
  perform public.write_audit(v_match.group_id, 'game_ended', jsonb_build_object(
    'match_id', p_match_id, 'game_id', v_game.id, 'penalty_winner', p_penalty_winner));
end;
$$;

-- Leaving early (admins): someone on the pitch must be swapped off first.
-- They go to the bench, and still count for the night (and the money).
create or replace function public.check_out(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_open(v_match);
  if exists (select 1 from public.stint_players sp join public.stints s on s.id = sp.stint_id
             where s.match_id = p_match_id and s.ended_at is null and sp.player_id = p_player_id) then
    raise exception 'They''re on the pitch. Swap them off first.';
  end if;

  update public.match_players set left_at = coalesce(left_at, now()), team = null
  where match_id = p_match_id and player_id = p_player_id;
  if not found then
    raise exception 'That player is not checked in.';
  end if;

  perform public.write_audit(v_match.group_id, 'checked_out',
    jsonb_build_object('match_id', p_match_id, 'player_id', p_player_id));
end;
$$;

-- End night (admins) now also stops the clock: a game still on ends with its
-- current score. Voting opens for everyone checked in.
create or replace function public.end_night(p_match_id uuid)
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

  perform public.stop_game(p_match_id, null);

  select rc.voting_hours into v_hours from public.rating_config rc where rc.group_id = v_match.group_id;
  update public.matches
  set status = 'voting', voting_closes_at = now() + make_interval(hours => coalesce(v_hours, 24))
  where id = p_match_id;

  perform public.write_audit(v_match.group_id, 'night_ended', jsonb_build_object('match_id', p_match_id));
end;
$$;

-- Cancelling a night also stops a game that's on (nothing counts anyway).
create or replace function public.cancel_night(p_match_id uuid, p_reason text, p_note text, p_fee numeric)
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

  perform public.stop_game(p_match_id, null);
  update public.matches
  set status = 'cancelled', cancel_reason = p_reason, cancel_note = v_note,
      cancel_fee = coalesce(p_fee, 0), cancelled_at = now()
  where id = p_match_id;

  perform public.write_audit(v_match.group_id, 'night_cancelled',
    jsonb_build_object('match_id', p_match_id, 'reason', p_reason, 'fee', coalesce(p_fee, 0)));
end;
$$;


-- -----------------------------------------------------------------------------
-- Goals: admins only, into a game
-- -----------------------------------------------------------------------------

-- The Phase 1 lineup editor is replaced by the team board and games, and
-- log_goal gains a game, so the old versions go.
drop function public.save_lineup(uuid, jsonb);
drop function public.apply_lineup(uuid, jsonb);
drop function public.log_goal(uuid, uuid, uuid);

-- Admins log goals: the scorer, then the assister (or none). The goal goes to
-- the game in progress, or to p_game_id to add one that was forgotten (also
-- after the night: ratings recalculate if voting has closed). It belongs to
-- the scorer's latest lineup period in that game, and to their team in it.
-- Admins' goals count as confirmed; players can still dispute them.
create function public.log_goal(p_match_id uuid, p_scorer_id uuid, p_assister_id uuid default null,
                                p_game_id uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_match       public.matches := public.load_match(p_match_id);
  v_game        uuid := p_game_id;
  v_stint       uuid;
  v_team        text;
  v_assist_team text;
  v_goal        uuid;
begin
  perform public.require_admin(v_match.group_id);
  if v_match.status = 'cancelled' then
    raise exception 'This night was cancelled.';
  elsif v_match.status = 'draft' then
    raise exception 'Start the night before logging goals.';
  end if;

  if v_game is null then
    v_game := (public.running_game(p_match_id)).id;
    if v_game is null then
      raise exception 'No game is on. Start a game first.';
    end if;
  elsif not exists (select 1 from public.games g where g.id = v_game and g.match_id = p_match_id) then
    raise exception 'That game is not part of this night.';
  end if;

  select sp.stint_id, sp.team into v_stint, v_team
  from public.stint_players sp
  join public.stints s on s.id = sp.stint_id
  where s.game_id = v_game and sp.player_id = p_scorer_id
  order by s.ordinal desc
  limit 1;
  if v_stint is null then
    raise exception 'The scorer didn''t play in this game.';
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

  insert into public.goals (match_id, game_id, stint_id, scoring_team, scorer_id, assister_id, confirmed, created_by)
  values (p_match_id, v_game, v_stint, v_team, p_scorer_id, p_assister_id, true, auth.uid())
  returning id into v_goal;
  return v_goal;
end;
$$;


-- -----------------------------------------------------------------------------
-- The table gains minutes: average minutes on the pitch per night, and all
-- minutes in goal (profiles; the goalkeeper suggestion). Its columns change,
-- so it is dropped and created again.
-- -----------------------------------------------------------------------------
drop function public.get_leaderboard(uuid, int);

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
  qualified        boolean,
  avg_minutes      int,
  minutes_in_goal  int
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
           (select rc.min_matches_for_leaderboard from public.rating_config rc where rc.group_id = p_group_id), 3),
         round(avg(mr.minutes_played))::int,
         round(sum(mr.minutes_in_goal))::int
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
-- Permissions (the same rules as the end of files 3 and 4). Internal helpers
-- stay private; the app actions are for signed-in users. Functions replaced
-- with "create or replace" keep the permissions they had.
-- =============================================================================
revoke execute on function
  public.running_game(uuid),
  public.require_night_playing(public.matches),
  public.check_pitch_lineup(uuid, text[], jsonb),
  public.start_period(uuid, uuid, jsonb),
  public.stop_game(uuid, text),
  public.set_team_board(uuid, jsonb),
  public.start_game(uuid, text, text, uuid, uuid),
  public.swap_players(uuid, jsonb, boolean),
  public.end_game(uuid, text),
  public.log_goal(uuid, uuid, uuid, uuid),
  public.get_leaderboard(uuid, int)
from public, anon, authenticated;

grant execute on function
  public.set_team_board(uuid, jsonb),
  public.start_game(uuid, text, text, uuid, uuid),
  public.swap_players(uuid, jsonb, boolean),
  public.end_game(uuid, text),
  public.log_goal(uuid, uuid, uuid, uuid),
  public.get_leaderboard(uuid, int)
to authenticated;

grant execute on all functions in schema public to service_role;
