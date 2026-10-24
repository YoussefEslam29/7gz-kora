-- =============================================================================
-- 7GZ-KORA: demo data for testing
--
-- Creates the group "Demo FC" with 12 fake players and these nights:
--   * last season: one finished night (shows in the All-time tab only)
--   * three finished nights this season; 4 people still owe for last week's
--   * ten days ago: cancelled because of rain
--   * yesterday: voting still open; 3 people have paid back so far
--   * in 3 days: planned, with a 10-player limit: 10 in, 1 on the waiting
--     list and 1 out, so you can see the waiting list
-- Ahmed (player 3) collects the money every night: 600 EGP ÷ 12 = 50 each.
--
-- Run it AFTER the 4 migration files, ideally in a separate test project.
-- To see it: sign in to the app, tap "Join a group" and enter  DEMO-KICK
-- The first real person to join becomes the group's admin.
--
-- To remove it later:   delete from public.groups where name = 'Demo FC';
-- =============================================================================

-- 20:00 in Cairo on the given day. pg_temp = these helpers disappear when
-- this run ends.
create or replace function pg_temp.night_start(p_day date)
returns timestamptz
language sql stable as $$
  select (p_day + time '20:00') at time zone 'Africa/Cairo'
$$;

-- Builds one finished (or voting) night. Player numbers (1-12) refer to
-- positions in the players array.
create or replace function pg_temp.seed_night(
  p_group    uuid,
  p_players  uuid[],
  p_played   date,
  p_team_a   int[],
  p_team_b   int[],
  p_gk_a     int,
  p_gk_b     int,
  p_goals    int[],    -- pairs: scorer, assister (0 = no assist)
  p_status   text,     -- 'closed' or 'voting'
  p_voters   int[],    -- who has voted
  p_unpaid   int[]     -- who hasn't paid Ahmed back yet
) returns uuid
language plpgsql as $$
declare
  v_match uuid;
  v_stint uuid;
  v_n     int;
  v_team  text;
  i       int;
begin
  insert into public.matches (group_id, played_at, starts_at, location, cost, collector_player_id,
                              status, voting_closes_at, closed_at)
  values (
    p_group, p_played, pg_temp.night_start(p_played), 'Club pitch 3', 600, p_players[3],
    p_status,
    case when p_status = 'voting' then now() + interval '20 hours' else p_played + interval '1 day' end,
    case when p_status = 'closed' then p_played + interval '1 day' end
  )
  returning id into v_match;

  insert into public.stints (match_id, ordinal, weight) values (v_match, 1, 1) returning id into v_stint;

  foreach v_n in array p_team_a || p_team_b loop
    -- Checked in around 20:00; player 8 is always late.
    insert into public.match_players (match_id, player_id, arrived_at)
    values (v_match, p_players[v_n],
            pg_temp.night_start(p_played) + make_interval(mins => case when v_n = 8 then 25 else v_n - 8 end));
    insert into public.stint_players (stint_id, match_id, player_id, team, is_goalkeeper)
    values (
      v_stint, v_match, p_players[v_n],
      case when v_n = any (p_team_a) then 'A' else 'B' end,
      v_n in (p_gk_a, p_gk_b)
    );
  end loop;

  i := 1;
  while i < coalesce(array_length(p_goals, 1), 0) loop
    v_team := case when p_goals[i] = any (p_team_a) then 'A' else 'B' end;
    insert into public.goals (match_id, stint_id, scoring_team, scorer_id, assister_id, confirmed)
    values (
      v_match, v_stint, v_team, p_players[p_goals[i]],
      case when p_goals[i + 1] > 0 then p_players[p_goals[i + 1]] end,
      true
    );
    i := i + 2;
  end loop;

  -- Votes: everyone around 6-8, scorers a bit higher, a few "didn't see".
  insert into public.ratings_votes (match_id, voter_id, target_id, score, didnt_see)
  select v_match, voter.player_id, target.player_id,
         case when abs(hashtext(voter.player_id::text || target.player_id::text)) % 13 = 0 then null
              else least(10, greatest(1,
                     6 + (abs(hashtext(target.player_id::text || voter.player_id::text)) % 4) - 1
                       + (select count(*) from public.goals g
                          where g.match_id = v_match and g.scorer_id = target.player_id)::int))
         end,
         abs(hashtext(voter.player_id::text || target.player_id::text)) % 13 = 0
  from public.match_players voter
  join public.match_players target on target.match_id = voter.match_id and target.player_id <> voter.player_id
  where voter.match_id = v_match
    and voter.player_id = any (select p_players[x] from unnest(p_voters) x);

  -- Man of the Match: each voter picks the player they scored highest.
  insert into public.mvp_votes (match_id, voter_id, target_id)
  select distinct on (rv.voter_id) v_match, rv.voter_id, rv.target_id
  from public.ratings_votes rv
  where rv.match_id = v_match and rv.score is not null
  order by rv.voter_id, rv.score desc, rv.target_id;

  -- Everyone except the collector (player 3) and p_unpaid paid back the next day.
  insert into public.night_payments (match_id, player_id, paid_at)
  select v_match, p_players[x], pg_temp.night_start(p_played) + interval '1 day'
  from unnest(p_team_a || p_team_b) x
  where x <> 3 and x <> all (p_unpaid);

  if p_status = 'closed' then
    perform public.compute_match_ratings(v_match);
  end if;
  return v_match;
end;
$$;

do $$
declare
  v_group   uuid;
  v_players uuid[] := '{}';
  v_name    text;
  v_id      uuid;
  v_night   uuid;
  v_year    int := extract(year from current_date)::int;
  v_all     int[] := array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
begin
  if exists (select 1 from public.groups where name = 'Demo FC') then
    raise notice 'Demo data is already loaded.';
    return;
  end if;

  insert into public.groups (name, invite_code) values ('Demo FC', 'DEMO-KICK') returning id into v_group;
  insert into public.rating_config (group_id) values (v_group);

  foreach v_name in array array[
    'Youssef', 'Omar', 'Ahmed', 'Karim', 'Mostafa', 'Ziad',
    'Hassan', 'Tarek', 'محمد', 'Ali', 'Seif', 'Mahmoud'
  ] loop
    insert into public.players (group_id, display_name) values (v_group, v_name) returning id into v_id;
    v_players := v_players || v_id;
  end loop;

  -- Last season (shows up in the All-time tab only): B wins 2-1.
  perform pg_temp.seed_night(v_group, v_players, make_date(v_year - 1, 12, 18),
    array[1, 2, 3, 4, 5, 6], array[7, 8, 9, 10, 11, 12], 5, 9,
    array[7, 9, 10, 0, 2, 0], 'closed', v_all, '{}');

  -- Three weeks ago: A wins 4-1.
  perform pg_temp.seed_night(v_group, v_players, current_date - 21,
    array[1, 2, 3, 4, 5, 6], array[7, 8, 9, 10, 11, 12], 6, 12,
    array[1, 2, 1, 0, 3, 1, 7, 8, 2, 4], 'closed', v_all, '{}');

  -- Two weeks ago: B wins 3-2.
  perform pg_temp.seed_night(v_group, v_players, current_date - 14,
    array[1, 3, 5, 7, 9, 11], array[2, 4, 6, 8, 10, 12], 11, 12,
    array[2, 4, 4, 0, 9, 1, 6, 2, 1, 3], 'closed', v_all, '{}');

  -- Ten days ago: cancelled three hours before because of rain. Nothing to pay.
  insert into public.matches (group_id, played_at, starts_at, location, cost, collector_player_id,
                              status, cancel_reason, cancelled_at)
  values (v_group, current_date - 10, pg_temp.night_start(current_date - 10), 'Club pitch 3', 600, v_players[3],
          'cancelled', 'rain', pg_temp.night_start(current_date - 10) - interval '3 hours');

  -- Last week: A wins 3-0 (clean sheet for player 10 in goal). 4 people still owe Ahmed.
  perform pg_temp.seed_night(v_group, v_players, current_date - 7,
    array[1, 2, 4, 5, 8, 10], array[3, 6, 7, 9, 11, 12], 10, 11,
    array[1, 2, 8, 0, 4, 1], 'closed', v_all, array[7, 9, 11, 12]);

  -- Yesterday: voting still open, 5 players have voted, 3 have paid back.
  perform pg_temp.seed_night(v_group, v_players, current_date - 1,
    array[1, 3, 5, 7, 9, 11], array[2, 4, 6, 8, 10, 12], 11, 12,
    array[5, 1, 8, 2, 3, 0], 'voting', array[2, 3, 4, 5, 6], array[5, 6, 7, 8, 9, 10, 11, 12]);

  -- In 3 days: planned, limit 10. Players 1-10 are in, 11 is waiting, 12 is out.
  insert into public.matches (group_id, played_at, starts_at, location, cost, collector_player_id,
                              player_cap, status)
  values (v_group, current_date + 3, pg_temp.night_start(current_date + 3), 'Club pitch 3', 600, v_players[3],
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
