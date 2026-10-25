-- =============================================================================
-- 7GZ-KORA: demo data for testing
--
-- Creates the group "Demo FC" with 15 fake players and these nights, each
-- with several 10-minute games:
--   * last season: one finished night (shows in the All-time tab only)
--   * three weeks and two weeks ago: finished, Team A v Team B
--     (two weeks ago Tarek arrived 25 minutes late)
--   * ten days ago: cancelled because of rain
--   * last week: finished, 15 players in three teams of 5, winner stays on:
--     a draw won on penalties, a mid-game swap and a late arrival;
--     4 people still owe for it
--   * yesterday: voting still open, with an "End game and swap"; 3 people
--     have paid back so far
--   * in 3 days: planned, with a 10-player limit: 10 in, 1 on the waiting
--     list and 1 out, so you can see the waiting list
-- Ahmed (player 3) collects the money every night: 600 EGP split equally.
-- Ali and Mahmoud are happy to play in goal.
--
-- Run it AFTER the 5 migration files, ideally in a separate test project.
-- To see it: sign in to the app, tap "Join a group" and enter  DEMO-KICK
-- The first real person to join becomes the group's admin.
--
-- To remove it later:   delete from public.groups where name = 'Demo FC';
-- =============================================================================

-- 20:00 in Cairo on the given day, plus some minutes. pg_temp = these helpers
-- disappear when this run ends.
create or replace function pg_temp.at_pitch(p_day date, p_minutes int default 0)
returns timestamptz
language sql stable as $$
  select ((p_day + time '20:00') at time zone 'Africa/Cairo') + make_interval(mins => p_minutes)
$$;

-- A night and who came (player numbers 1-15, positions in the players
-- array). Players in p_late arrived 25 minutes after the start.
create or replace function pg_temp.seed_night(
  p_group   uuid,
  p_players uuid[],
  p_played  date,
  p_side    int,
  p_here    int[],
  p_late    int[],
  p_status  text      -- 'closed' or 'voting'
) returns uuid
language plpgsql as $$
declare
  v_match uuid;
begin
  insert into public.matches (group_id, played_at, starts_at, location, cost, collector_player_id,
                              players_per_side, status, voting_closes_at, closed_at)
  values (
    p_group, p_played, pg_temp.at_pitch(p_played), 'Club pitch 3', 600, p_players[3], p_side,
    p_status,
    case when p_status = 'voting' then now() + interval '20 hours' else p_played + interval '1 day' end,
    case when p_status = 'closed' then p_played + interval '1 day' end
  )
  returning id into v_match;

  -- Checked in a few minutes before 20:00; late arrivals at 20:25.
  insert into public.match_players (match_id, player_id, arrived_at)
  select v_match, p_players[x], pg_temp.at_pitch(p_played, case when x = any (p_late) then 25 else -(x % 5) end)
  from unnest(p_here) x;
  return v_match;
end;
$$;

-- A game starting p_start minutes after 20:00. Its lineup periods are added
-- with seed_period. Returns the game's id.
create or replace function pg_temp.seed_game(
  p_match uuid, p_start int, p_team_one text, p_team_two text, p_penalty_winner text default null
) returns uuid
language plpgsql as $$
declare
  v_game uuid;
begin
  insert into public.games (match_id, ordinal, team_one, team_two, planned_minutes, started_at, ended_at, penalty_winner)
  select p_match, (select count(*) + 1 from public.games g where g.match_id = p_match), p_team_one, p_team_two, 10,
         m.starts_at + make_interval(mins => p_start), m.starts_at + make_interval(mins => p_start), p_penalty_winner
  from public.matches m
  where m.id = p_match
  returning id into v_game;
  return v_game;
end;
$$;

-- A lineup period of a game, starting where its last one ended. p_one and
-- p_two are the players of the game's first and second team, with their
-- goalkeepers; p_goals are pairs: scorer, assister (0 = no assist).
create or replace function pg_temp.seed_period(
  p_game    uuid,
  p_players uuid[],
  p_minutes int,
  p_one     int[],
  p_gk_one  int,
  p_two     int[],
  p_gk_two  int,
  p_goals   int[] default '{}'
) returns void
language plpgsql as $$
declare
  v_game  public.games;
  v_stint uuid;
  i       int := 1;
begin
  select * into v_game from public.games where id = p_game;

  insert into public.stints (match_id, game_id, ordinal, started_at, ended_at)
  select v_game.match_id, p_game, coalesce(max(s.ordinal), 0) + 1,
         v_game.ended_at, v_game.ended_at + make_interval(mins => p_minutes)
  from public.stints s
  where s.match_id = v_game.match_id
  returning id into v_stint;

  update public.games set ended_at = ended_at + make_interval(mins => p_minutes) where id = p_game;

  insert into public.stint_players (stint_id, match_id, player_id, team, is_goalkeeper)
  select v_stint, v_game.match_id, p_players[x], v_game.team_one, x = p_gk_one from unnest(p_one) x
  union all
  select v_stint, v_game.match_id, p_players[x], v_game.team_two, x = p_gk_two from unnest(p_two) x;

  while i < coalesce(array_length(p_goals, 1), 0) loop
    insert into public.goals (match_id, game_id, stint_id, scoring_team, scorer_id, assister_id, confirmed)
    values (
      v_game.match_id, p_game, v_stint,
      case when p_goals[i] = any (p_one) then v_game.team_one else v_game.team_two end,
      p_players[p_goals[i]],
      case when p_goals[i + 1] > 0 then p_players[p_goals[i + 1]] end,
      true
    );
    i := i + 2;
  end loop;
end;
$$;

-- A 10-minute game, Team A v Team B, with one lineup period.
create or replace function pg_temp.seed_ab_game(
  p_match uuid, p_players uuid[], p_start int,
  p_a int[], p_gk_a int, p_b int[], p_gk_b int, p_goals int[] default '{}'
) returns void
language plpgsql as $$
begin
  perform pg_temp.seed_period(pg_temp.seed_game(p_match, p_start, 'A', 'B'), p_players, 10,
                              p_a, p_gk_a, p_b, p_gk_b, p_goals);
end;
$$;

-- Finishes a night: the team board shows everyone's last team; votes
-- (everyone around 6-8, scorers a bit higher, a few "didn't see"), Man of the
-- Match, payments back to Ahmed the next day, and ratings for a closed night.
create or replace function pg_temp.seed_finish(
  p_match   uuid,
  p_players uuid[],
  p_voters  int[],    -- who has voted
  p_unpaid  int[]     -- who hasn't paid Ahmed back yet
) returns void
language plpgsql as $$
begin
  update public.match_players mp
  set team = (select sp.team from public.stint_players sp join public.stints s on s.id = sp.stint_id
              where sp.match_id = mp.match_id and sp.player_id = mp.player_id
              order by s.ordinal desc limit 1)
  where mp.match_id = p_match;

  insert into public.ratings_votes (match_id, voter_id, target_id, score, didnt_see)
  select p_match, voter.player_id, target.player_id,
         case when abs(hashtext(voter.player_id::text || target.player_id::text)) % 13 = 0 then null
              else least(10, greatest(1,
                     6 + (abs(hashtext(target.player_id::text || voter.player_id::text)) % 4) - 1
                       + (select count(*) from public.goals g
                          where g.match_id = p_match and g.scorer_id = target.player_id)::int))
         end,
         abs(hashtext(voter.player_id::text || target.player_id::text)) % 13 = 0
  from public.match_players voter
  join public.match_players target on target.match_id = voter.match_id and target.player_id <> voter.player_id
  where voter.match_id = p_match
    and voter.player_id = any (select p_players[x] from unnest(p_voters) x);

  -- Man of the Match: each voter picks the player they scored highest.
  insert into public.mvp_votes (match_id, voter_id, target_id)
  select distinct on (rv.voter_id) p_match, rv.voter_id, rv.target_id
  from public.ratings_votes rv
  where rv.match_id = p_match and rv.score is not null
  order by rv.voter_id, rv.score desc, rv.target_id;

  -- Everyone except the collector (player 3) and p_unpaid paid back the next day.
  insert into public.night_payments (match_id, player_id, paid_at)
  select p_match, mp.player_id, m.starts_at + interval '1 day'
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  where mp.match_id = p_match
    and mp.player_id <> p_players[3]
    and mp.player_id <> all (select p_players[x] from unnest(p_unpaid) x);

  if (select m.status from public.matches m where m.id = p_match) = 'closed' then
    perform public.compute_match_ratings(p_match);
  end if;
end;
$$;

do $$
declare
  v_group   uuid;
  v_players uuid[] := '{}';
  v_name    text;
  v_id      uuid;
  v_night   uuid;
  v_game    uuid;
  v_year    int := extract(year from current_date)::int;
  v_twelve  int[] := array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  v_all     int[] := array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
begin
  if exists (select 1 from public.groups where name = 'Demo FC') then
    raise notice 'Demo data is already loaded.';
    return;
  end if;

  insert into public.groups (name, invite_code) values ('Demo FC', 'DEMO-KICK') returning id into v_group;
  insert into public.rating_config (group_id) values (v_group);

  foreach v_name in array array[
    'Youssef', 'Omar', 'Ahmed', 'Karim', 'Mostafa', 'Ziad', 'Hassan', 'Tarek',
    'محمد', 'Ali', 'Seif', 'Mahmoud', 'Khaled', 'Amr', 'Hany'
  ] loop
    insert into public.players (group_id, display_name) values (v_group, v_name) returning id into v_id;
    v_players := v_players || v_id;
  end loop;
  update public.players set happy_in_goal = true where id in (v_players[10], v_players[12]);

  -- Last season (shows up in the All-time tab only): B wins two of three.
  v_night := pg_temp.seed_night(v_group, v_players, make_date(v_year - 1, 12, 18), 6, v_twelve, '{}', 'closed');
  perform pg_temp.seed_ab_game(v_night, v_players, 0,  array[1, 2, 3, 4, 5, 6], 5, array[7, 8, 9, 10, 11, 12], 9, array[7, 8]);
  perform pg_temp.seed_ab_game(v_night, v_players, 12, array[1, 2, 3, 4, 5, 6], 5, array[7, 8, 9, 10, 11, 12], 9, array[10, 0, 2, 0]);
  perform pg_temp.seed_ab_game(v_night, v_players, 24, array[1, 2, 3, 4, 5, 6], 5, array[7, 8, 9, 10, 11, 12], 9, array[8, 7]);
  perform pg_temp.seed_finish(v_night, v_players, v_twelve, '{}');

  -- Three weeks ago: four games; A wins two, B one, one draw.
  v_night := pg_temp.seed_night(v_group, v_players, current_date - 21, 6, v_twelve, '{}', 'closed');
  perform pg_temp.seed_ab_game(v_night, v_players, 0,  array[1, 2, 3, 4, 5, 6], 6, array[7, 8, 9, 10, 11, 12], 12, array[1, 2, 1, 0]);
  perform pg_temp.seed_ab_game(v_night, v_players, 12, array[1, 2, 3, 4, 5, 6], 6, array[7, 8, 9, 10, 11, 12], 12, array[3, 1, 7, 8]);
  perform pg_temp.seed_ab_game(v_night, v_players, 24, array[1, 2, 3, 4, 5, 6], 6, array[7, 8, 9, 10, 11, 12], 12, array[2, 4]);
  perform pg_temp.seed_ab_game(v_night, v_players, 36, array[1, 2, 3, 4, 5, 6], 6, array[7, 8, 9, 10, 11, 12], 12, array[8, 7]);
  perform pg_temp.seed_finish(v_night, v_players, v_twelve, '{}');

  -- Two weeks ago: Tarek (8) arrived 25 minutes late and played from game 3.
  v_night := pg_temp.seed_night(v_group, v_players, current_date - 14, 6, v_twelve, array[8], 'closed');
  perform pg_temp.seed_ab_game(v_night, v_players, 0,  array[1, 3, 5, 7, 9, 11], 11, array[2, 4, 6, 10, 12], 12, array[2, 4]);
  perform pg_temp.seed_ab_game(v_night, v_players, 12, array[1, 3, 5, 7, 9, 11], 11, array[2, 4, 6, 10, 12], 12, array[9, 1, 4, 0]);
  perform pg_temp.seed_ab_game(v_night, v_players, 26, array[1, 3, 5, 7, 9, 11], 11, array[2, 4, 6, 8, 10, 12], 12, array[6, 8]);
  perform pg_temp.seed_ab_game(v_night, v_players, 38, array[1, 3, 5, 7, 9, 11], 11, array[2, 4, 6, 8, 10, 12], 12, array[1, 3]);
  perform pg_temp.seed_finish(v_night, v_players, v_twelve, '{}');

  -- Ten days ago: cancelled three hours before because of rain. Nothing to pay.
  insert into public.matches (group_id, played_at, starts_at, location, cost, collector_player_id,
                              status, cancel_reason, cancelled_at)
  values (v_group, current_date - 10, pg_temp.at_pitch(current_date - 10), 'Club pitch 3', 600, v_players[3],
          'cancelled', 'rain', pg_temp.at_pitch(current_date - 10, -180));

  -- Last week: 15 players, three teams of 5, winner stays on. Tarek arrived
  -- 25 minutes late and joined Team C. 600 / 15 = 40 each; 4 still owe Ahmed.
  v_night := pg_temp.seed_night(v_group, v_players, current_date - 7, 5, v_all, array[8], 'closed');
  -- Game 1: A 2-1 B. A stays on, C comes on.
  perform pg_temp.seed_period(pg_temp.seed_game(v_night, 0, 'A', 'B'), v_players, 10,
    array[1, 2, 4, 5, 10], 10, array[3, 6, 7, 9, 11], 11, array[1, 2, 4, 0, 7, 9]);
  -- Game 2: A 0-0 C. C wins on penalties and stays on; B comes on.
  perform pg_temp.seed_period(pg_temp.seed_game(v_night, 12, 'A', 'C', 'C'), v_players, 10,
    array[1, 2, 4, 5, 10], 10, array[12, 13, 14, 15], 12);
  -- Game 3: C v B. C leads 1-0 after 6 minutes; Tarek (C) and Ziad (B) swap
  -- and the game carries on. B scores twice: C 1-2 B.
  v_game := pg_temp.seed_game(v_night, 26, 'C', 'B');
  perform pg_temp.seed_period(v_game, v_players, 6, array[8, 12, 13, 14, 15], 12, array[3, 6, 7, 9, 11], 11, array[13, 14]);
  perform pg_temp.seed_period(v_game, v_players, 4, array[6, 12, 13, 14, 15], 12, array[3, 7, 8, 9, 11], 11, array[3, 8, 9, 0]);
  -- Game 4: B 0-1 A.
  perform pg_temp.seed_period(pg_temp.seed_game(v_night, 40, 'B', 'A'), v_players, 10,
    array[3, 7, 8, 9, 11], 11, array[1, 2, 4, 5, 10], 10, array[5, 1]);
  perform pg_temp.seed_finish(v_night, v_players, v_all, array[7, 9, 11, 13]);

  -- Yesterday: voting still open. In game 2 the admin chose "End game and
  -- swap" after 6 minutes (Youssef and Omar swapped). 5 have voted, 3 paid back.
  v_night := pg_temp.seed_night(v_group, v_players, current_date - 1, 6, v_twelve, '{}', 'voting');
  perform pg_temp.seed_ab_game(v_night, v_players, 0, array[1, 3, 5, 7, 9, 11], 11, array[2, 4, 6, 8, 10, 12], 12, array[5, 1]);
  perform pg_temp.seed_period(pg_temp.seed_game(v_night, 12, 'A', 'B'), v_players, 6,
    array[1, 3, 5, 7, 9, 11], 11, array[2, 4, 6, 8, 10, 12], 12);
  perform pg_temp.seed_period(pg_temp.seed_game(v_night, 18, 'A', 'B'), v_players, 10,
    array[2, 3, 5, 7, 9, 11], 11, array[1, 4, 6, 8, 10, 12], 12, array[1, 4]);
  perform pg_temp.seed_finish(v_night, v_players, array[2, 3, 4, 5, 6], array[5, 6, 7, 8, 9, 10, 11, 12]);

  -- In 3 days: planned, limit 10. Players 1-10 are in, 11 is waiting, 12 is out.
  insert into public.matches (group_id, played_at, starts_at, location, cost, collector_player_id,
                              player_cap, status)
  values (v_group, current_date + 3, pg_temp.at_pitch(current_date + 3), 'Club pitch 3', 600, v_players[3],
          10, 'draft')
  returning id into v_night;

  insert into public.rsvps (match_id, player_id, status, status_changed_at, waiting_since)
  select v_night, v_players[x],
         case when x <= 10 then 'in' when x = 11 then 'waiting' else 'out' end,
         now() - make_interval(hours => 30 - x),
         case when x = 11 then now() - make_interval(hours => 30 - x) end
  from generate_series(1, 12) x;

  raise notice 'Demo FC created. Join it in the app with the code DEMO-KICK';
end;
$$;
