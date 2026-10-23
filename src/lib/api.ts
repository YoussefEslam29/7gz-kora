// Every call the app makes to Supabase lives here.
// Reads use normal queries (Row Level Security limits them to your groups).
// Writes go through the database functions in supabase/migrations/*_actions.sql,
// which check permissions and return human-readable errors.
import { supabase } from './supabase'
import type {
  Goal,
  Group,
  LeaderboardRow,
  LineupEntry,
  Match,
  MatchDetail,
  MatchRating,
  MatchSummary,
  Member,
  Membership,
  MvpVote,
  Player,
  RatingConfig,
  Role,
  Stint,
  StintPlayer,
  Vote,
} from './types'

type Result = { data: unknown; error: { message: string } | null }

/** Returns the data of a Supabase response, or throws its error message. */
function unwrap<T>(res: Result): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

async function rpc<T = void>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return unwrap<T>(await supabase.rpc(fn, args))
}

// ---------------------------------------------------------------------------
// Groups and members
// ---------------------------------------------------------------------------
export async function getMemberships(userId: string): Promise<Membership[]> {
  const rows = unwrap<{ role: Role; player_id: string; groups: Group }[]>(
    await supabase.from('group_members').select('role, player_id, groups(id, name, invite_code)').eq('user_id', userId),
  )
  return rows
    .map((r) => ({ group: r.groups, role: r.role, player_id: r.player_id }))
    .sort((a, b) => a.group.name.localeCompare(b.group.name))
}

export const createGroup = (name: string, displayName: string) =>
  rpc<string>('create_group', { p_name: name, p_display_name: displayName })

export const joinGroup = (code: string, displayName: string) =>
  rpc<string>('join_group', { p_code: code, p_display_name: displayName })

export const regenerateInviteCode = (groupId: string) =>
  rpc<string>('regenerate_invite_code', { p_group_id: groupId })

export const disableInviteCode = (groupId: string) => rpc('disable_invite_code', { p_group_id: groupId })

export const setMemberRole = (groupId: string, userId: string, role: Role) =>
  rpc('set_member_role', { p_group_id: groupId, p_user_id: userId, p_role: role })

/** Removes a member, or leaves the group when userId is your own id. */
export const removeMember = (groupId: string, userId: string) =>
  rpc('remove_member', { p_group_id: groupId, p_user_id: userId })

export async function renameGroup(groupId: string, name: string) {
  unwrap(await supabase.from('groups').update({ name: name.trim() }).eq('id', groupId))
}

export async function renamePlayer(playerId: string, name: string) {
  unwrap(await supabase.from('players').update({ display_name: name.trim() }).eq('id', playerId))
}

export async function getPlayers(groupId: string): Promise<Player[]> {
  const rows = unwrap<(Omit<Player, 'avatar_url'> & { profiles: { avatar_url: string | null } | null })[]>(
    await supabase
      .from('players')
      .select('id, group_id, user_id, display_name, is_guest, profiles!players_user_id_fkey(avatar_url)')
      .eq('group_id', groupId)
      .order('display_name'),
  )
  return rows.map(({ profiles, ...p }) => ({ ...p, avatar_url: profiles?.avatar_url ?? null }))
}

export async function getMembers(groupId: string): Promise<Member[]> {
  return unwrap(
    await supabase.from('group_members').select('user_id, player_id, role, joined_at').eq('group_id', groupId),
  )
}

export async function getRatingConfig(groupId: string): Promise<RatingConfig | null> {
  return unwrap(await supabase.from('rating_config').select('*').eq('group_id', groupId).maybeSingle())
}

/** Closes voting on any match whose 24 hours are up. Called when the app opens. */
export const closeDueMatches = (groupId: string) => rpc<number>('close_due_matches', { p_group_id: groupId })

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------
export async function listMatches(groupId: string): Promise<MatchSummary[]> {
  return unwrap(
    await supabase
      .from('matches')
      .select('*, goals(scoring_team, disputed), match_ratings(player_id, rating, is_mvp), match_players!match_players_match_id_fkey(player_id)')
      .eq('group_id', groupId)
      .order('played_at', { ascending: false })
      .order('created_at', { ascending: false }),
  )
}

export async function getMatch(matchId: string): Promise<MatchDetail> {
  const [match, stints, stintPlayers, players, goals, ratings, votes, mvpVotes] = await Promise.all([
    supabase.from('matches').select('*').eq('id', matchId).single(),
    supabase.from('stints').select('id, ordinal, weight').eq('match_id', matchId).order('ordinal'),
    supabase.from('stint_players').select('stint_id, player_id, team, is_goalkeeper').eq('match_id', matchId),
    supabase.from('match_players').select('player_id').eq('match_id', matchId),
    supabase.from('goals').select('*').eq('match_id', matchId).order('created_at'),
    supabase.from('match_ratings').select('*').eq('match_id', matchId),
    supabase.from('ratings_votes').select('voter_id, target_id, score, didnt_see').eq('match_id', matchId),
    supabase.from('mvp_votes').select('voter_id, target_id').eq('match_id', matchId),
  ])
  const stintList = unwrap<Stint[]>(stints)
  const current = stintList[stintList.length - 1]
  return {
    match: unwrap<Match>(match),
    stints: stintList,
    lineup: unwrap<StintPlayer[]>(stintPlayers).filter((sp) => sp.stint_id === current?.id),
    playerIds: unwrap<{ player_id: string }[]>(players).map((p) => p.player_id),
    goals: unwrap<Goal[]>(goals),
    ratings: unwrap<MatchRating[]>(ratings),
    votes: unwrap<Vote[]>(votes),
    mvpVotes: unwrap<MvpVote[]>(mvpVotes),
  }
}

export const createMatch = (groupId: string, playedAt: string, location: string, lineup: LineupEntry[]) =>
  rpc<string>('create_match', { p_group_id: groupId, p_played_at: playedAt, p_location: location, p_lineup: lineup })

export const saveLineup = (matchId: string, lineup: LineupEntry[]) =>
  rpc('save_lineup', { p_match_id: matchId, p_lineup: lineup })

export const updateMatchDetails = (matchId: string, playedAt: string, location: string) =>
  rpc('update_match_details', { p_match_id: matchId, p_played_at: playedAt, p_location: location })

export const deleteMatch = (matchId: string) => rpc('delete_match', { p_match_id: matchId })
export const finishMatch = (matchId: string) => rpc('finish_match', { p_match_id: matchId })
export const extendVoting = (matchId: string, hours: number) =>
  rpc('extend_voting', { p_match_id: matchId, p_hours: hours })
export const closeVoting = (matchId: string) => rpc('close_voting', { p_match_id: matchId })

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------
export const logGoal = (matchId: string, scorerId: string, assisterId: string | null) =>
  rpc<string>('log_goal', { p_match_id: matchId, p_scorer_id: scorerId, p_assister_id: assisterId })

export const editGoal = (goalId: string, scorerId: string, assisterId: string | null) =>
  rpc('edit_goal', { p_goal_id: goalId, p_scorer_id: scorerId, p_assister_id: assisterId })

export const deleteGoal = (goalId: string) => rpc('delete_goal', { p_goal_id: goalId })
export const confirmGoal = (goalId: string) => rpc('confirm_goal', { p_goal_id: goalId })
export const disputeGoal = (goalId: string) => rpc('dispute_goal', { p_goal_id: goalId })

// ---------------------------------------------------------------------------
// Votes
// ---------------------------------------------------------------------------
export type VoteInput = { target_id: string; score: number } | { target_id: string; didnt_see: true }

export const submitVotes = (matchId: string, votes: VoteInput[], mvpId: string | null) =>
  rpc('submit_votes', { p_match_id: matchId, p_votes: votes, p_mvp_id: mvpId })

/** Who has voted so far (not what they voted). */
export const getVoteStatus = (matchId: string) =>
  rpc<{ player_id: string; has_voted: boolean }[]>('vote_status', { p_match_id: matchId })

/** Of the given matches, the ones where this player has already voted. */
export async function getVotedMatchIds(playerId: string, matchIds: string[]): Promise<Set<string>> {
  if (matchIds.length === 0) return new Set()
  const rows = unwrap<{ match_id: string }[]>(
    await supabase.from('ratings_votes').select('match_id').eq('voter_id', playerId).in('match_id', matchIds),
  )
  return new Set(rows.map((r) => r.match_id))
}

// ---------------------------------------------------------------------------
// Leaderboard and profiles
// ---------------------------------------------------------------------------

/** Years that have at least one finished match, newest first. */
export async function getSeasonYears(groupId: string): Promise<number[]> {
  const rows = unwrap<{ played_at: string }[]>(
    await supabase.from('matches').select('played_at').eq('group_id', groupId).eq('status', 'closed'),
  )
  return [...new Set(rows.map((r) => Number(r.played_at.slice(0, 4))))].sort((a, b) => b - a)
}

/** year = null for all-time. */
export const getLeaderboard = (groupId: string, year: number | null) =>
  rpc<LeaderboardRow[]>('get_leaderboard', { p_group_id: groupId, p_year: year })

export type HistoryRow = MatchRating & { matches: Match }

/** A player's rated matches, newest first. */
export async function getPlayerHistory(playerId: string): Promise<HistoryRow[]> {
  const rows = unwrap<HistoryRow[]>(
    await supabase.from('match_ratings').select('*, matches!inner(*)').eq('player_id', playerId),
  )
  return rows.sort((a, b) => b.matches.played_at.localeCompare(a.matches.played_at))
}
