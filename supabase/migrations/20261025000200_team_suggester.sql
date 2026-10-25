-- =============================================================================
-- 7GZ-KORA: the team suggester (file 6 of 6)
--
-- "Suggest teams" on the team board (Plans/Football-scenario.md section 5)
-- runs in the app (src/lib/suggest.ts), from ratings already stored. The
-- database only gains its one setting, "Extra team from N players"
-- (section 7): when at least this many players are left over after two full
-- teams, they make Team C; fewer wait on the bench as subs.
--
-- Files 1 to 5 already run on the live project, so this file only adds to
-- them. Run it once, in the SQL Editor. It can run at any time, even during
-- a night.
-- =============================================================================

alter table public.groups
  add column min_extra_team_size int not null default 3
    constraint groups_min_extra_team_size_check check (min_extra_team_size between 2 and 11);

-- Admins change it in Settings, straight on the table, under the same row
-- rule as renaming the group (file 1, "admins rename their groups"). A new
-- column keeps the table's permissions (file 3): members of the group can
-- read it, signed-out visitors can't.
grant update (min_extra_team_size) on public.groups to authenticated;
