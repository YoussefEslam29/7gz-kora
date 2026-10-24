// Shapes of the rows the app reads from Supabase (see supabase/migrations).

export type Team = 'A' | 'B'
/** Bib colours. Team C (blue) plays once games arrive in stage 2. */
export type Bib = Team | 'C'
export type Role = 'admin' | 'member'
/** draft = a planned night. A night is a row in matches; only the screens say "night". */
export type MatchStatus = 'draft' | 'playing' | 'voting' | 'closed' | 'cancelled'
export type RsvpStatus = 'in' | 'waiting' | 'out'
export type CancelReason = 'rain' | 'not_enough_players' | 'pitch_problem' | 'other'

export interface Group {
  id: string
  name: string
  invite_code: string | null
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
  clean_sheet_min_share: number
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

export interface Stint {
  id: string
  ordinal: number
  weight: number
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

/** Every component of a match rating, as stored by compute_match_ratings. */
export interface Breakdown {
  base: number
  goals: number
  assists: number
  net_goals: number
  net_goal_diff: number
  result: number
  clean_sheets: number
  saves: number
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
}

/** A match in a list, with just enough to show the score. */
export interface MatchSummary extends Match {
  goals: { scoring_team: Team; disputed: boolean }[]
  match_ratings: { player_id: string; rating: number; is_mvp: boolean }[]
  match_players: { player_id: string }[]
  rsvps: Rsvp[]
}

/** Everything the match page needs. */
export interface MatchDetail {
  match: Match
  stints: Stint[]
  /** Lineup of the current (latest) stint. */
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

export interface LineupEntry {
  player_id: string
  team: Team
  is_goalkeeper: boolean
}
