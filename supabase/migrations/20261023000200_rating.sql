-- =============================================================================
-- 7GZ-KORA: rating system (file 2 of 4)
--
-- This file is the ONE place where ratings are calculated.
--
--   match_rating = w_analytics x analytics_score + w_votes x peer_vote_average
--
-- If a player received fewer than `min_votes` votes, the vote part is ignored
-- and the rating is the analytics score alone ("stats only").
--
-- HOW TO TUNE THE NUMBERS
--   * For an existing group: Supabase dashboard > Table Editor >
--     rating_config > edit the row for your group. Changes apply to matches
--     whose ratings are calculated after that (when voting closes, or when an
--     admin edits a goal of a closed match).
--   * Defaults for NEW groups: change rating_points_defaults() and the column
--     defaults of rating_config below.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- DEFAULT POINTS (section 6.2 of the brief). All analytics numbers live here.
-- -----------------------------------------------------------------------------
create function public.rating_points_defaults()
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
    "clean_sheet_min_share": 0.25,

    "save": 0.15,
    "save_cap": 1.0,

    "analytics_min": 1.0,
    "analytics_max": 10.0
  }'::jsonb;
$$;


-- -----------------------------------------------------------------------------
-- Per-group rating settings. One row per group (created with the group).
-- -----------------------------------------------------------------------------
create table public.rating_config (
  group_id                    uuid primary key references public.groups (id) on delete cascade,
  -- The two weights must add up to 1.
  w_analytics                 numeric not null default 0.65,
  w_votes                     numeric not null default 0.35,
  -- Players with fewer votes than this get a "stats only" rating.
  min_votes                   int not null default 2 check (min_votes >= 0),
  -- Matches needed before a player appears on the main leaderboard.
  min_matches_for_leaderboard int not null default 3 check (min_matches_for_leaderboard >= 0),
  -- How long voting stays open after the admin finishes a match.
  voting_hours                int not null default 24 check (voting_hours between 1 and 336),
  -- Point values. Any key left out falls back to rating_points_defaults().
  points                      jsonb not null default public.rating_points_defaults(),
  check (w_analytics >= 0 and w_votes >= 0 and abs(w_analytics + w_votes - 1) < 0.0001)
);


-- -----------------------------------------------------------------------------
-- Stored result per player per match (recalculated, never edited by hand)
-- -----------------------------------------------------------------------------
create table public.match_ratings (
  match_id        uuid not null references public.matches (id) on delete cascade,
  player_id       uuid not null references public.players (id) on delete cascade,
  analytics_score numeric not null,
  vote_average    numeric,
  vote_count      int not null default 0,
  stats_only      boolean not null,
  -- Exact value, used for averages.
  final_rating    numeric not null,
  -- What the app shows: one decimal (8.315 -> 8.3, 5.5625 -> 5.6).
  rating          numeric generated always as (round(final_rating, 1)) stored,
  goals           int not null default 0,
  assists         int not null default 0,
  clean_sheets    int not null default 0,
  saves           int not null default 0,
  mvp_votes       int not null default 0,
  -- Man of the Match: most MVP votes (ties are shared). Not part of the rating.
  is_mvp          boolean not null default false,
  -- Every component, so the app can show "how was this calculated".
  breakdown       jsonb not null,
  computed_at     timestamptz not null default now(),
  primary key (match_id, player_id)
);

create index match_ratings_player_idx on public.match_ratings (player_id);

alter table public.rating_config enable row level security;
alter table public.match_ratings enable row level security;

create policy "members read rating config" on public.rating_config
  for select to authenticated using (public.is_group_member(group_id));
create policy "admins edit rating config" on public.rating_config
  for update to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

create policy "members read ratings" on public.match_ratings
  for select to authenticated using (public.is_group_member(public.match_group_id(match_id)));


-- -----------------------------------------------------------------------------
-- compute_match_ratings: THE rating calculation.
-- Deletes and rewrites match_ratings for one match. Safe to run any number
-- of times; it always gives the same answer for the same data.
-- -----------------------------------------------------------------------------
create function public.compute_match_ratings(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.rating_config%rowtype;
  pts jsonb;
  v_base         numeric;
  v_goal         numeric;
  v_goal_cap     numeric;
  v_assist       numeric;
  v_assist_cap   numeric;
  v_net_goal     numeric;
  v_net_min      numeric;
  v_net_max      numeric;
  v_win          numeric;
  v_draw         numeric;
  v_loss         numeric;
  v_cs           numeric;
  v_cs_cap       numeric;
  v_cs_min_share numeric;
  v_save         numeric;
  v_save_cap     numeric;
  v_min          numeric;
  v_max          numeric;
begin
  -- Lock the match row so two recalculations of the same match cannot clash.
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

  pts            := public.rating_points_defaults() || coalesce(cfg.points, '{}'::jsonb);
  v_base         := (pts ->> 'base')::numeric;
  v_goal         := (pts ->> 'goal')::numeric;
  v_goal_cap     := (pts ->> 'goal_cap')::numeric;
  v_assist       := (pts ->> 'assist')::numeric;
  v_assist_cap   := (pts ->> 'assist_cap')::numeric;
  v_net_goal     := (pts ->> 'net_goal')::numeric;
  v_net_min      := (pts ->> 'net_goal_min')::numeric;
  v_net_max      := (pts ->> 'net_goal_max')::numeric;
  v_win          := (pts ->> 'win')::numeric;
  v_draw         := (pts ->> 'draw')::numeric;
  v_loss         := (pts ->> 'loss')::numeric;
  v_cs           := (pts ->> 'clean_sheet')::numeric;
  v_cs_cap       := (pts ->> 'clean_sheet_cap')::numeric;
  v_cs_min_share := (pts ->> 'clean_sheet_min_share')::numeric;
  v_save         := (pts ->> 'save')::numeric;
  v_save_cap     := (pts ->> 'save_cap')::numeric;
  v_min          := (pts ->> 'analytics_min')::numeric;
  v_max          := (pts ->> 'analytics_max')::numeric;

  delete from public.match_ratings where match_id = p_match_id;

  insert into public.match_ratings (
    match_id, player_id, analytics_score, vote_average, vote_count, stats_only,
    final_rating, goals, assists, clean_sheets, saves, mvp_votes, is_mvp, breakdown
  )
  with
  -- Goals that count: everything except disputed goals.
  counted_goals as (
    select g.* from public.goals g
    where g.match_id = p_match_id and not g.disputed
  ),
  -- Each stint's share of the match (weights normalised to add up to 1)
  -- and the score within that stint.
  stint_scores as (
    select s.id as stint_id,
           s.weight / sum(s.weight) over () as share,
           (select count(*) from counted_goals g where g.stint_id = s.id and g.scoring_team = 'A') as goals_a,
           (select count(*) from counted_goals g where g.stint_id = s.id and g.scoring_team = 'B') as goals_b
    from public.stints s
    where s.match_id = p_match_id
  ),
  -- One row per player per stint they were on the pitch for.
  player_stints as (
    select sp.player_id,
           sp.is_goalkeeper,
           ss.share,
           case sp.team when 'A' then ss.goals_a - ss.goals_b else ss.goals_b - ss.goals_a end as net,
           case sp.team when 'A' then ss.goals_b else ss.goals_a end as conceded
    from public.stint_players sp
    join stint_scores ss on ss.stint_id = sp.stint_id
  ),
  -- Team impact, result and clean sheets, summed across stints by weight.
  team_impact as (
    select ps.player_id,
           sum(ps.net * ps.share) as net_goals,
           sum(ps.share * case when ps.net > 0 then v_win when ps.net < 0 then v_loss else v_draw end) as result_points,
           count(*) filter (
             where ps.is_goalkeeper and ps.conceded = 0 and ps.share >= v_cs_min_share
           ) as clean_sheets
    from player_stints ps
    group by ps.player_id
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
  stats as (
    select mp.player_id,
           (select count(*) from counted_goals g where g.scorer_id = mp.player_id) as goals,
           (select count(*) from counted_goals g where g.assister_id = mp.player_id) as assists,
           (select count(*) from public.saves sv
             where sv.match_id = p_match_id and sv.goalkeeper_id = mp.player_id) as saves,
           coalesce(t.net_goals, 0) as net_goals,
           coalesce(t.result_points, 0) as result_points,
           coalesce(t.clean_sheets, 0) as clean_sheets,
           v.vote_average,
           coalesce(v.vote_count, 0) as vote_count,
           coalesce(mv.n, 0) as mvp_votes
    from public.match_players mp
    left join team_impact t on t.player_id = mp.player_id
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
         jsonb_build_object(
           'base',          v_base,
           'goals',         round(f.goal_pts, 2),
           'assists',       round(f.assist_pts, 2),
           'net_goals',     round(f.net_pts, 2),
           'net_goal_diff', round(f.net_goals, 2),
           'result',        round(f.result_pts, 2),
           'clean_sheets',  round(f.cs_pts, 2),
           'saves',         round(f.save_pts, 2),
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
-- Recalculate automatically when data of a CLOSED match is edited
-- (e.g. an admin fixes a goal after voting closed).
-- -----------------------------------------------------------------------------
create function public.recompute_if_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match uuid;
begin
  if tg_op = 'DELETE' then
    v_match := old.match_id;
  else
    v_match := new.match_id;
  end if;

  if (select m.status from public.matches m where m.id = v_match) = 'closed' then
    perform public.compute_match_ratings(v_match);
  end if;
  return null;
end;
$$;

create trigger goals_recompute after insert or update or delete on public.goals
  for each row execute function public.recompute_if_closed();
create trigger saves_recompute after insert or update or delete on public.saves
  for each row execute function public.recompute_if_closed();
create trigger stints_recompute after insert or update or delete on public.stints
  for each row execute function public.recompute_if_closed();
create trigger stint_players_recompute after insert or update or delete on public.stint_players
  for each row execute function public.recompute_if_closed();
