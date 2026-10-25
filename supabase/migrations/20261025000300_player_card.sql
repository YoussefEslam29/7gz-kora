-- =============================================================================
-- 7GZ-KORA: the player card (file 7 of 7)
--
-- Every player can fill in a card about themselves
-- (Plans/Player-card-and-motion.md): a shirt number, their strong foot, a
-- favourite position (for show only: teams have no fixed positions), a short
-- motto, and a self-rating from 1 to 10 on five skills. The app shows the
-- card on the profile, compares the self-rating with friends' votes, and uses
-- it as a new player's starting strength in the team suggester. It never
-- changes a night's rating: compute_match_ratings doesn't read it.
--
-- Files 1 to 6 already run on the live project, so this file only adds to
-- them. Run it once, in the SQL Editor. It can run at any time, even during
-- a night.
-- =============================================================================

alter table public.players
  add column shirt_number smallint
    constraint players_shirt_number_check check (shirt_number between 1 and 99),
  add column strong_foot text
    constraint players_strong_foot_check check (strong_foot in ('right', 'left', 'both')),
  add column favourite_position text
    constraint players_favourite_position_check
      check (favourite_position in ('goal', 'defence', 'midfield', 'attack', 'anywhere')),
  add column motto text
    constraint players_motto_check check (char_length(motto) between 1 and 60),
  add column skill_shooting smallint
    constraint players_skill_shooting_check check (skill_shooting between 1 and 10),
  add column skill_passing smallint
    constraint players_skill_passing_check check (skill_passing between 1 and 10),
  add column skill_dribbling smallint
    constraint players_skill_dribbling_check check (skill_dribbling between 1 and 10),
  add column skill_defending smallint
    constraint players_skill_defending_check check (skill_defending between 1 and 10),
  add column skill_fitness smallint
    constraint players_skill_fitness_check check (skill_fitness between 1 and 10),
  -- The self-rating is the average of all five, so it's all five or none.
  add constraint players_skills_all_or_none check (
    num_nulls(skill_shooting, skill_passing, skill_dribbling, skill_defending, skill_fitness) in (0, 5)
  );

-- Players change their own card and admins anyone's, under the same row rule
-- as the name (file 1, "rename yourself, or anyone if admin"). The new
-- columns keep the table's read permissions (file 3): the group can read
-- them, signed-out visitors can't. Nothing else about a player becomes
-- changeable.
grant update (shirt_number, strong_foot, favourite_position, motto,
              skill_shooting, skill_passing, skill_dribbling, skill_defending, skill_fitness)
  on public.players to authenticated;
