-- =============================================================================
-- Ta7dy-El-La3eeba: demo data for testing
--
-- Creates the group "Demo FC" with 12 fake players, 4 finished matches
-- (3 this year, 1 last year) and 1 match where voting is still open.
--
-- Run it AFTER the 3 migration files, ideally in a separate test project.
-- To see it: sign in to the app, tap "Join a group" and enter  DEMO-KICK
-- The first real person to join becomes the group's admin.
--
-- To remove it later:   delete from public.groups where name = 'Demo FC';
-- =============================================================================

-- Helper that builds one match. pg_temp = it disappears when this run ends.
-- Player numbers (1-12) refer to positions in the players array.
create or replace function pg_temp.seed_match(
  p_group    uuid,
  p_players  uuid[],
  p_played   date,
  p_team_a   int[],
  p_team_b   int[],
  p_gk_a     int,
  p_gk_b     int,
  p_goals    int[],    -- pairs: scorer, assister (0 = no assist)
  p_status   text,     -- 'closed' or 'voting'
  p_voters   int[]     -- who has voted (players 1-12)
) returns uuid
language plpgsql as $$
declare
  v_match uuid;
  v_stint uuid;
  v_n     int;
  v_team  text;
  i       int;
begin
  insert into public.matches (group_id, played_at, location, status, voting_closes_at, closed_at)
  values (
    p_group, p_played, 'Club pitch 3', p_status,
    case when p_status = 'voting' then now() + interval '20 hours' else p_played + interval '1 day' end,
    case when p_status = 'closed' then p_played + interval '1 day' end
  )
  returning id into v_match;

  insert into public.stints (match_id, ordinal, weight) values (v_match, 1, 1) returning id into v_stint;

  foreach v_n in array p_team_a || p_team_b loop
    insert into public.match_players (match_id, player_id) values (v_match, p_players[v_n]);
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
  perform pg_temp.seed_match(v_group, v_players, make_date(v_year - 1, 12, 18),
    array[1, 2, 3, 4, 5, 6], array[7, 8, 9, 10, 11, 12], 5, 9,
    array[7, 9, 10, 0, 2, 0], 'closed', v_all);

  -- Three weeks ago: A wins 4-1.
  perform pg_temp.seed_match(v_group, v_players, current_date - 21,
    array[1, 2, 3, 4, 5, 6], array[7, 8, 9, 10, 11, 12], 6, 12,
    array[1, 2, 1, 0, 3, 1, 7, 8, 2, 4], 'closed', v_all);

  -- Two weeks ago: B wins 3-2.
  perform pg_temp.seed_match(v_group, v_players, current_date - 14,
    array[1, 3, 5, 7, 9, 11], array[2, 4, 6, 8, 10, 12], 11, 12,
    array[2, 4, 4, 0, 9, 1, 6, 2, 1, 3], 'closed', v_all);

  -- Last week: A wins 3-0 (clean sheet for player 10 in goal).
  perform pg_temp.seed_match(v_group, v_players, current_date - 7,
    array[1, 2, 4, 5, 8, 10], array[3, 6, 7, 9, 11, 12], 10, 11,
    array[1, 2, 8, 0, 4, 1], 'closed', v_all);

  -- Yesterday: voting still open, 5 players have voted so far.
  perform pg_temp.seed_match(v_group, v_players, current_date - 1,
    array[1, 3, 5, 7, 9, 11], array[2, 4, 6, 8, 10, 12], 11, 12,
    array[5, 1, 8, 2, 3, 0], 'voting', array[2, 3, 4, 5, 6]);

  raise notice 'Demo FC created. Join it in the app with the code DEMO-KICK';
end;
$$;
