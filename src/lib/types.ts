// Shapes of the rows the app reads from Supabase (see supabase/migrations).

/** Teams wear bib colours: A white (no bibs), B orange, C blue. */
export type Team = 'A' | 'B' | 'C'
export type Role = 'admin' | 'member'
/** draft = a planned night. A night is a row in matches; only the screens say "night". */
export type MatchStatus = 'draft' | 'playing' | 'voting' | 'closed' | 'cancelled'
export type RsvpStatus = 'in' | 'waiting' | 'out'
export type CancelReason = 'rain' | 'not_enough_players' | 'pitch_problem' | 'other'

export interface Group {
  id: string
  name: string
  invite_code: string | null
  /** "Extra team from N players": the team suggester makes Team C from this many left over. */
  min_extra_team_size: number
}

export interface Membership {
  group: Group
  role: Role
  player_id: string
}

export interface Player {
  id: string
  group_id: string
  user_id: string | null
  display_name: string
  is_guest: boolean
  /** Suggested first when a game needs a goalkeeper. */
  happy_in_goal: boolean
  avatar_url: string | null
}

export interface Member {
  user_id: string
  player_id: string
  role: Role
  joined_at: string
}

/** Point values for the analytics score (rating_points_defaults in SQL). */
export interface RatingPoints {
  base: number
  goal: number
  goal_cap: number
  assist: number
  assist_cap: number
  net_goal: number
  net_goal_min: number
  net_goal_max: number
  win: number
  draw: number
  loss: number
  clean_sheet: number
  clean_sheet_cap: number
  /** A clean sheet needs a whole game in goal lasting at least this long. */
  clean_sheet_min_minutes: number
  save: number
  save_cap: number
  analytics_min: number
  analytics_max: number
}

export interface RatingConfig {
  group_id: string
  w_analytics: number
  w_votes: number
  min_votes: number
  min_matches_for_leaderboard: number
  voting_hours: number
  points: Partial<RatingPoints>
}

export interface Match {
  id: string
  group_id: string
  played_at: string
  starts_at: string | null
  location: string | null
  duration_minutes: number
  cost: number
  currency: string
  collector_player_id: string | null
  players_per_side: number
  game_minutes: number
  /** null = no limit (no waiting list). */
  player_cap: number | null
  status: MatchStatus
  voting_closes_at: string | null
  closed_at: string | null
  cancel_reason: CancelReason | null
  cancel_note: string | null
  cancel_fee: number
  cancelled_at: string | null
  created_at: string
}

/** One player's answer for a planned night. */
export interface Rsvp {
  player_id: string
  status: RsvpStatus
  status_changed_at: string
  /** Order on the waiting list. */
  waiting_since: string | null
  /** Set when they moved up from the waiting list ("You're in!"). */
  promoted_at: string | null
}

/** Checked in at the pitch. */
export interface CheckIn {
  player_id: string
  arrived_at: string
  left_at: string | null
  /** The team board: the team they're on now. null = on the bench. */
  team: Team | null
}

/** What plan_night / update_night take (see supabase/migrations/*_nights.sql). */
export interface NightDetails {
  played_at: string
  starts_at: string
  location: string
  duration_minutes: number
  cost: number
  players_per_side: number
  collector_player_id: string | null
  game_minutes: number
  player_cap: number | null
}

/** The Plan a night form: a local date and time instead of a timestamp. */
export interface NightForm {
  day: string
  time: string
  location: string
  duration_minutes: number
  cost: number
  players_per_side: number
  collector_player_id: string | null
  game_minutes: number
  player_cap: number | null
}

/** A row of a night's money card (night_money). */
export interface Payer {
  player_id: string
  /** Whole pounds: the cost ÷ the number of payers, rounded up. */
  share: number
  paid_at: string | null
  /** The collector counts as paid automatically. */
  is_collector: boolean
}

/** One unpaid share of the signed-in player (money_owed). */
export interface MoneyOwed {
  match_id: string
  played_at: string
  share: number
  currency: string
  collector_player_id: string | null
}

/** One short game of a night (see supabase/migrations/*_games.sql). */
export interface Game {
  id: string
  match_id: string
  ordinal: number
  team_one: Team
  team_two: Team
  /** The timer's guide: it buzzes, but an admin ends the game. */
  planned_minutes: number
  started_at: string
  /** null while the game is on. */
  ended_at: string | null
  /** A draw with a team waiting: who won the shootout. It only decides who stays on. */
  penalty_winner: Team | null
}

/** A lineup period of a game (a "stint" in the database). Minutes come from the times. */
export interface Stint {
  id: string
  game_id: string
  ordinal: number
  started_at: string
  /** null while it's still going. */
  ended_at: string | null
}

export interface StintPlayer {
  stint_id: string
  player_id: string
  team: Team
  is_goalkeeper: boolean
}

export interface Goal {
  id: string
  match_id: string
  game_id: string
  stint_id: string
  scoring_team: Team
  scorer_id: string
  assister_id: string | null
  confirmed: boolean
  disputed: boolean
  created_by: string | null
  created_at: string
}

export interface Vote {
  voter_id: string
  target_id: string
  score: number | null
  didnt_see: boolean
}

export interface MvpVote {
  voter_id: string
  target_id: string
}

/** Every component of a night's rating, as stored by compute_match_ratings. */
export interface Breakdown {
  base: number
  goals: number
  assists: number
  net_goals: number
  /** Goal difference while on the pitch, added up over the night. */
  net_goal_diff: number
  result: number
  clean_sheets: number
  saves: number
  /** Minutes on the pitch. Missing on nights rated before games existed. */
  minutes?: number
  analytics: number
  vote_average: number | null
  vote_count: number
  stats_only: boolean
  w_analytics: number
  w_votes: number
  min_votes: number
  final: number
}

export interface MatchRating {
  match_id: string
  player_id: string
  analytics_score: number
  vote_average: number | null
  vote_count: number
  stats_only: boolean
  final_rating: number
  /** Rounded to one decimal: what the app shows. */
  rating: number
  goals: number
  assists: number
  clean_sheets: number
  saves: number
  mvp_votes: number
  is_mvp: boolean
  minutes_played: number
  minutes_in_goal: number
  breakdown: Breakdown
}

export interface LeaderboardRow {
  player_id: string
  display_name: string
  matches: number
  avg_rating: number
  avg_rating_exact: number
  goals: number
  assists: number
  mvps: number
  clean_sheets: number
  avg_votes: number | null
  qualified: boolean
  /** Average minutes on the pitch per night. */
  avg_minutes: number
  /** All minutes in goal. */
  minutes_in_goal: number
}

/** Each player's average night rating, this season and all-time (for the team suggester). */
export interface RatingAverages {
  season: Map<string, number>
  allTime: Map<string, number>
}

/** A night in a list, with its games and enough to show their scores. */
export interface MatchSummary extends Match {
  games: Game[]
  goals: Pick<Goal, 'game_id' | 'scoring_team' | 'disputed'>[]
  match_ratings: { player_id: string; rating: number; is_mvp: boolean }[]
  match_players: { player_id: string }[]
  rsvps: Rsvp[]
}

/** Everything the night page needs. */
export interface MatchDetail {
  match: Match
  games: Game[]
  /** The game in progress, if any. */
  runningGame: Game | null
  stints: Stint[]
  /** Who was on the pitch in every lineup period. */
  stintPlayers: StintPlayer[]
  /** Who is on the pitch right now (empty between games). */
  lineup: StintPlayer[]
  /** Everyone checked in. */
  playerIds: string[]
  checkIns: CheckIn[]
  rsvps: Rsvp[]
  goals: Goal[]
  ratings: MatchRating[]
  votes: Vote[]
  mvpVotes: MvpVote[]
}

/** One player on the pitch, as swap_players takes it. */
export interface LineupEntry {
  player_id: string
  team: Team
  is_goalkeeper: boolean
}

/** One row of the team board, as set_team_board takes it. */
export interface BoardEntry {
  player_id: string
  /** null = on the bench. */
  team: Team | null
}
