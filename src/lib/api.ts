// Every call the app makes to Supabase lives here.
// Reads use normal queries (Row Level Security limits them to your groups).
// Writes go through the database functions in supabase/migrations/*_actions.sql,
// which check permissions and return human-readable errors.
import { supabase } from './supabase'
import type {
  Account,
  AccountHit,
  AccountInput,
  AccountPage,
  AuditEntry,
  BoardEntry,
  CancelReason,
  ChatMessage,
  CheckIn,
  Game,
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
  MoneyOwed,
  MvpVote,
  NightDetails,
  Payer,
  Player,
  PublicGroup,
  RatingAverages,
  RatingConfig,
  RatingSettings,
  Role,
  Rsvp,
  RsvpStatus,
  Stint,
  StintPlayer,
  Team,
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
/** Everything the app reads about a group. */
const GROUP_COLUMNS = 'id, name, invite_code, min_extra_team_size, image_path, is_public'

export async function getMemberships(userId: string): Promise<Membership[]> {
  const rows = unwrap<{ role: Role; player_id: string; groups: Group }[]>(
    await supabase.from('group_members').select(`role, player_id, groups(${GROUP_COLUMNS})`).eq('user_id', userId),
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

/** "Extra team from N players" for the team suggester (admins). */
export async function setMinExtraTeamSize(groupId: string, size: number) {
  unwrap(await supabase.from('groups').update({ min_extra_team_size: size }).eq('id', groupId))
}

/** Everything the app reads about a player, the player card included. */
const PLAYER_COLUMNS = [
  'id, group_id, user_id, display_name, is_guest, happy_in_goal, show_stats, instapay_phone',
  'shirt_number, strong_foot, favourite_position, motto',
  'skill_shooting, skill_passing, skill_dribbling, skill_defending, skill_fitness',
].join(', ')

export async function getPlayers(groupId: string): Promise<Player[]> {
  const rows = unwrap<(Omit<Player, 'avatar_url'> & { profiles: { avatar_url: string | null } | null })[]>(
    await supabase
      .from('players')
      .select(`${PLAYER_COLUMNS}, profiles!players_user_id_fkey(avatar_url)`)
      .eq('group_id', groupId)
      .order('display_name'),
  )
  return rows.map(({ profiles, ...p }) => ({ ...p, avatar_url: profiles?.avatar_url ?? null }))
}

/** A player's name in this group: yourself, or anyone if you're an admin. */
export async function renamePlayer(playerId: string, name: string) {
  unwrap(await supabase.from('players').update({ display_name: name.trim() }).eq('id', playerId))
}

export async function getMembers(groupId: string): Promise<Member[]> {
  return unwrap(
    await supabase.from('group_members').select('user_id, player_id, role, joined_at').eq('group_id', groupId),
  )
}

export async function getRatingConfig(groupId: string): Promise<RatingConfig | null> {
  return unwrap(await supabase.from('rating_config').select('*').eq('group_id', groupId).maybeSingle())
}

/** Admins: the four main rating settings. They count for nights whose voting closes from then on. */
export async function updateRatingSettings(groupId: string, settings: RatingSettings) {
  unwrap(await supabase.from('rating_config').update(settings).eq('group_id', groupId))
}

/** Closes voting on any match whose 24 hours are up. Called when the app opens. */
export const closeDueMatches = (groupId: string) => rpc<number>('close_due_matches', { p_group_id: groupId })

// ---------------------------------------------------------------------------
// Your account (Plans/Accounts-groups-and-chat.md section 1)
// ---------------------------------------------------------------------------
export const getMyAccount = () => rpc<Account>('my_account')

/** Saves the whole account at once (a field left out is cleared). Every group's copy follows. */
export const saveMyAccount = (account: AccountInput) => rpc('save_my_account', { p_account: account })

/** The end of the sign-up questions. */
export const finishSignUp = (account: AccountInput) => rpc('finish_sign_up', { p_account: account })

/** Someone's account page: skills only if they show their stats (or it's you). */
export const getAccount = (userId: string) => rpc<AccountPage>('get_account', { p_user_id: userId })

/** Find: up to 20 accounts whose name contains the text (2 or more letters). */
export const searchAccounts = (query: string) => rpc<AccountHit[]>('search_accounts', { p_query: query })

// ---------------------------------------------------------------------------
// Public groups and group photos (Plans/Accounts-groups-and-chat.md sections 4-5)
// ---------------------------------------------------------------------------
const GROUP_IMAGES = 'group-images'

/** The photo's web address (the bucket is public), or null. */
export function groupImageUrl(path: string | null): string | null {
  return path ? supabase.storage.from(GROUP_IMAGES).getPublicUrl(path).data.publicUrl : null
}

export const listPublicGroups = () => rpc<PublicGroup[]>('list_public_groups')

/** One tap: joins a public group with this name (the account's, unless changed). */
export const joinPublicGroup = (groupId: string, displayName: string) =>
  rpc<string>('join_public_group', { p_group_id: groupId, p_display_name: displayName })

/** Admins: Public (anyone signed in finds it and joins with one tap) or Private. */
export async function setGroupPublic(groupId: string, isPublic: boolean) {
  unwrap(await supabase.from('groups').update({ is_public: isPublic }).eq('id', groupId))
}

/** Admins: uploads a new group photo (already shrunk), points the group at it, and removes the old one. */
export async function setGroupPhoto(groupId: string, photo: Blob, oldPath: string | null): Promise<string> {
  const path = `${groupId}/${crypto.randomUUID()}.jpg`
  const bucket = supabase.storage.from(GROUP_IMAGES)
  unwrap(await bucket.upload(path, photo, { contentType: 'image/jpeg' }))
  unwrap(await supabase.from('groups').update({ image_path: path }).eq('id', groupId))
  // A leftover old file only takes space, so a failure to remove it is ignored.
  if (oldPath) await bucket.remove([oldPath])
  return path
}

/** Admins: back to the honeycomb with the logo. */
export async function removeGroupPhoto(groupId: string, path: string) {
  unwrap(await supabase.from('groups').update({ image_path: null }).eq('id', groupId))
  await supabase.storage.from(GROUP_IMAGES).remove([path])
}

/** A group's name, once you're in it (for the welcome message). */
export async function getGroupName(groupId: string): Promise<string> {
  return unwrap<{ name: string }>(await supabase.from('groups').select('name').eq('id', groupId).single()).name
}

// ---------------------------------------------------------------------------
// The group chat (Plans/Accounts-groups-and-chat.md section 6)
// ---------------------------------------------------------------------------
export const CHAT_PAGE = 50

/** A page of the chat, newest first: the latest, or the ones before a time. */
export async function getMessages(groupId: string, before: string | null): Promise<ChatMessage[]> {
  let query = supabase.from('group_messages').select('*').eq('group_id', groupId)
  if (before) query = query.lt('created_at', before)
  return unwrap(await query.order('created_at', { ascending: false }).limit(CHAT_PAGE))
}

export async function getMessage(id: string): Promise<ChatMessage | null> {
  return unwrap(await supabase.from('group_messages').select('*').eq('id', id).maybeSingle())
}

export const sendMessage = (groupId: string, body: string) =>
  rpc<string>('send_message', { p_group_id: groupId, p_body: body })

export const deleteMessage = (id: string) => rpc('delete_message', { p_message_id: id })

/**
 * Calls onChange with a message's id whenever one is sent or deleted in the
 * group (Supabase Realtime), and onLive with whether the connection is up.
 * The event is only a signal: the app reads the message itself, through the
 * normal API. Returns a function that stops listening.
 */
export function watchMessages(groupId: string, onChange: (id: string) => void, onLive: (live: boolean) => void) {
  const filter = `group_id=eq.${groupId}`
  const changed = (payload: { new: { id?: string } }) => {
    if (payload.new.id) onChange(payload.new.id)
  }
  const channel = supabase
    .channel(`chat:${groupId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter }, changed)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_messages', filter }, changed)
    .subscribe((status) => onLive(status === 'SUBSCRIBED'))
  return () => {
    void supabase.removeChannel(channel)
  }
}

// ---------------------------------------------------------------------------
// Nights (rows of the matches table)
// ---------------------------------------------------------------------------
/** Follows a Google Maps short link (maps.app.goo.gl/…) to the full address, through /api/map-link. */
export async function resolveMapLink(url: string): Promise<string | null> {
  const res = await fetch(`/api/map-link?url=${encodeURIComponent(url)}`)
  if (!res.ok) return null
  return ((await res.json()) as { url: string | null }).url
}

export async function listMatches(groupId: string): Promise<MatchSummary[]> {
  return unwrap(
    await supabase
      .from('matches')
      .select(
        '*, games!games_match_id_fkey(*), goals(game_id, scoring_team, disputed), match_ratings(player_id, rating, is_mvp), match_players!match_players_match_id_fkey(player_id), rsvps(player_id, status, status_changed_at, waiting_since, promoted_at)',
      )
      .eq('group_id', groupId)
      .order('played_at', { ascending: false })
      .order('created_at', { ascending: false }),
  )
}

export async function getMatch(matchId: string): Promise<MatchDetail> {
  const [match, games, stints, stintPlayers, players, rsvps, goals, ratings, votes, mvpVotes] = await Promise.all([
    supabase.from('matches').select('*').eq('id', matchId).single(),
    supabase.from('games').select('*').eq('match_id', matchId).order('ordinal'),
    supabase.from('stints').select('id, game_id, ordinal, started_at, ended_at').eq('match_id', matchId).order('ordinal'),
    supabase.from('stint_players').select('stint_id, player_id, team, is_goalkeeper').eq('match_id', matchId),
    supabase.from('match_players').select('player_id, arrived_at, left_at, team').eq('match_id', matchId).order('arrived_at'),
    supabase.from('rsvps').select('player_id, status, status_changed_at, waiting_since, promoted_at').eq('match_id', matchId),
    supabase.from('goals').select('*').eq('match_id', matchId).order('created_at'),
    supabase.from('match_ratings').select('*').eq('match_id', matchId),
    supabase.from('ratings_votes').select('voter_id, target_id, score, didnt_see').eq('match_id', matchId),
    supabase.from('mvp_votes').select('voter_id, target_id').eq('match_id', matchId),
  ])
  const gameList = unwrap<Game[]>(games)
  const stintList = unwrap<Stint[]>(stints)
  const lineups = unwrap<StintPlayer[]>(stintPlayers)
  // The lineup period still going (only while a game is on).
  const current = stintList.find((s) => s.ended_at === null)
  const checkIns = unwrap<CheckIn[]>(players)
  return {
    match: unwrap<Match>(match),
    games: gameList,
    runningGame: gameList.find((g) => g.ended_at === null) ?? null,
    stints: stintList,
    stintPlayers: lineups,
    lineup: current ? lineups.filter((sp) => sp.stint_id === current.id) : [],
    playerIds: checkIns.map((c) => c.player_id),
    checkIns,
    rsvps: unwrap<Rsvp[]>(rsvps),
    goals: unwrap<Goal[]>(goals),
    ratings: unwrap<MatchRating[]>(ratings),
    votes: unwrap<Vote[]>(votes),
    mvpVotes: unwrap<MvpVote[]>(mvpVotes),
  }
}

/** The most recent night (any status), to pre-fill "Plan a night". */
export async function getLastNight(groupId: string): Promise<Match | null> {
  return unwrap(
    await supabase
      .from('matches')
      .select('*')
      .eq('group_id', groupId)
      .order('played_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
}

export const planNight = (groupId: string, night: NightDetails) =>
  rpc<string>('plan_night', { p_group_id: groupId, p_night: night })

export const updateNight = (matchId: string, night: NightDetails) =>
  rpc('update_night', { p_match_id: matchId, p_night: night })

/** "I'm in" or "Out". Returns your new status: in, waiting (the night is full) or out. */
export const setRsvp = (matchId: string, status: 'in' | 'out') =>
  rpc<RsvpStatus>('set_rsvp', { p_match_id: matchId, p_status: status })

export const startNight = (matchId: string) => rpc('start_night', { p_match_id: matchId })
export const checkIn = (matchId: string, playerId: string) =>
  rpc('check_in', { p_match_id: matchId, p_player_id: playerId })
export const checkOut = (matchId: string, playerId: string) =>
  rpc('check_out', { p_match_id: matchId, p_player_id: playerId })
export const undoCheckIn = (matchId: string, playerId: string) =>
  rpc('undo_check_in', { p_match_id: matchId, p_player_id: playerId })
export const endNight = (matchId: string) => rpc('end_night', { p_match_id: matchId })
export const cancelNight = (matchId: string, reason: CancelReason, note: string, fee: number) =>
  rpc('cancel_night', { p_match_id: matchId, p_reason: reason, p_note: note, p_fee: fee })

// ---------------------------------------------------------------------------
// Games at the pitch (admins)
// ---------------------------------------------------------------------------
export const setTeamBoard = (matchId: string, board: BoardEntry[]) =>
  rpc('set_team_board', { p_match_id: matchId, p_board: board })

/** Returns the new game's id. */
export const startGame = (matchId: string, teamOne: Team, teamTwo: Team, keeperOne: string | null, keeperTwo: string | null) =>
  rpc<string>('start_game', {
    p_match_id: matchId,
    p_team_one: teamOne,
    p_team_two: teamTwo,
    p_keeper_one: keeperOne,
    p_keeper_two: keeperTwo,
  })

/** The whole new pitch. cont = "Swap and continue"; otherwise "End game and swap". Returns the game now on. */
export const swapPlayers = (matchId: string, lineup: LineupEntry[], cont: boolean) =>
  rpc<string>('swap_players', { p_match_id: matchId, p_lineup: lineup, p_continue: cont })

/** "Game over". penaltyWinner: who won a shootout after a draw (or null). */
export const endGame = (matchId: string, penaltyWinner: Team | null) =>
  rpc('end_game', { p_match_id: matchId, p_penalty_winner: penaltyWinner })

export const deleteMatch = (matchId: string) => rpc('delete_match', { p_match_id: matchId })
export const extendVoting = (matchId: string, hours: number) =>
  rpc('extend_voting', { p_match_id: matchId, p_hours: hours })
export const closeVoting = (matchId: string) => rpc('close_voting', { p_match_id: matchId })

// ---------------------------------------------------------------------------
// Money (the rule lives in the database: night_payer_rows)
// ---------------------------------------------------------------------------
export const getNightMoney = (matchId: string) => rpc<Payer[]>('night_money', { p_match_id: matchId })
export const getMoneyOwed = (groupId: string) => rpc<MoneyOwed[]>('money_owed', { p_group_id: groupId })
export const markPaid = (matchId: string, playerId: string) =>
  rpc('mark_paid', { p_match_id: matchId, p_player_id: playerId })
export const unmarkPaid = (matchId: string, playerId: string) =>
  rpc('unmark_paid', { p_match_id: matchId, p_player_id: playerId })

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------
/** Admins only. gameId = null: the game on now; otherwise an earlier game (a forgotten goal). */
export const logGoal = (matchId: string, scorerId: string, assisterId: string | null, gameId: string | null = null) =>
  rpc<string>('log_goal', { p_match_id: matchId, p_scorer_id: scorerId, p_assister_id: assisterId, p_game_id: gameId })

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

/** Ratings already stored, for the team suggester: each player's average this season and all-time. */
export async function getRatingAverages(groupId: string, year: number): Promise<RatingAverages> {
  const [season, allTime] = await Promise.all([getLeaderboard(groupId, year), getLeaderboard(groupId, null)])
  const byPlayer = (rows: LeaderboardRow[]) => new Map(rows.map((r) => [r.player_id, Number(r.avg_rating_exact)]))
  return { season: byPlayer(season), allTime: byPlayer(allTime) }
}

export type HistoryRow = MatchRating & { matches: Match }

/** A player's rated matches, newest first. */
export async function getPlayerHistory(playerId: string): Promise<HistoryRow[]> {
  const rows = unwrap<HistoryRow[]>(
    await supabase.from('match_ratings').select('*, matches!inner(*)').eq('player_id', playerId),
  )
  return rows.sort((a, b) => b.matches.played_at.localeCompare(a.matches.played_at))
}

// ---------------------------------------------------------------------------
// Change history (admins)
// ---------------------------------------------------------------------------
export const AUDIT_PAGE = 50

/** The group's change history, newest first, a page at a time (before = the oldest time already shown). */
export async function getAuditLog(groupId: string, before: string | null): Promise<AuditEntry[]> {
  let query = supabase.from('audit_log').select('id, actor_id, action, details, created_at').eq('group_id', groupId)
  if (before) query = query.lt('created_at', before)
  return unwrap(await query.order('created_at', { ascending: false }).limit(AUDIT_PAGE))
}
