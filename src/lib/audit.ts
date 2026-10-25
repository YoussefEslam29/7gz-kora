// The change history (Plans/Player-card-and-motion.md section 4): each line
// of the audit log as a plain sentence, after the name of who did it. Pure,
// tested in audit.test.ts. The details come from the database actions
// (supabase/migrations, files 3 to 5).
import { CANCEL_REASONS, formatDay } from './format'
import type { AuditEntry, CancelReason } from './types'

/** Plain text, or a name (shown in <Name>, because names can be Arabic). */
export type AuditPart = string | { name: string }

export interface AuditNames {
  /** A player's name from their id. */
  player: (playerId: string) => string
  /** The name of the player an account belongs to. */
  user: (userId: string) => string
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')

/** What someone did: ["checked ", { name: "Omar" }, " in"]. */
export function describeAudit(entry: AuditEntry, names: AuditNames): AuditPart[] {
  const d = entry.details
  const player = (key: string): AuditPart => ({ name: names.player(text(d[key])) })
  const user = (key: string): AuditPart => ({ name: names.user(text(d[key])) })

  switch (entry.action) {
    case 'member_joined':
      return [d.role === 'admin' ? 'joined the group as an admin' : 'joined the group']
    case 'invite_code_regenerated':
      return ['made a new invite code']
    case 'invite_code_disabled':
      return ['turned off invites']
    case 'member_role_changed':
      return d.role === 'admin' ? ['made ', user('user_id'), ' an admin'] : ['removed ', user('user_id'), ' as an admin']
    case 'member_removed':
      return d.user_id === entry.actor_id ? ['left the group'] : ['removed ', user('user_id'), ' from the group']
    case 'lineup_changed':
      return ['changed a lineup']
    case 'match_deleted':
      return [`deleted the night of ${formatDay(text(d.played_at))}`]
    case 'goal_edited':
      return d.assister_id
        ? ['changed a goal to ', player('scorer_id'), ', assist ', player('assister_id')]
        : ['changed a goal to ', player('scorer_id'), ', no assist']
    case 'goal_deleted': {
      const goal = (d.goal ?? {}) as Record<string, unknown>
      return ['deleted a goal by ', { name: names.player(text(goal.scorer_id)) }]
    }
    case 'goal_disputed':
      return ['disputed a goal']
    case 'voting_extended':
      return [`extended voting by ${Number(d.hours)} hours`]
    case 'voting_closed':
      return ['closed voting']
    case 'night_planned':
      return ['planned a night']
    case 'night_changed':
      return ["changed a night's details"]
    case 'night_started':
      return ['started a night']
    case 'checked_in':
      return ['checked ', player('player_id'), ' in']
    case 'checked_out':
      return ['marked ', player('player_id'), ' as left']
    case 'check_in_undone':
      return ['undid the check-in of ', player('player_id')]
    case 'night_ended':
      return ['ended a night']
    case 'night_cancelled':
      return [`cancelled a night (${CANCEL_REASONS[d.reason as CancelReason] ?? 'no reason given'})`]
    case 'payment_marked':
      return ['ticked off the payment of ', player('player_id')]
    case 'payment_unmarked':
      return ['unticked the payment of ', player('player_id')]
    case 'team_board_changed':
      return ['changed the team board']
    case 'game_started':
      return ['started a game']
    case 'players_swapped':
      return [d.continue === false ? 'swapped players and started a new game' : 'swapped players, and the game went on']
    case 'game_ended':
      return [d.penalty_winner ? `ended a game (Team ${text(d.penalty_winner)} won on penalties)` : 'ended a game']
    default:
      return [entry.action.replaceAll('_', ' ')]
  }
}
