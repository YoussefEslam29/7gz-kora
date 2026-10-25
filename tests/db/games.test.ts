// Tests for games during a night (supabase/migrations/20261025000100_games.sql):
// the team board, starting and ending games, swaps, penalties and
// admin-only goals. Acting as real signed-in users with RLS on.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, nightDetails, rpc, selectAs, setupGroup, startGame, startNight, type Team } from './helpers'

let db: PGlite

beforeAll(async () => {
  db = await createDb()
})

afterAll(async () => {
  await db.close()
})

async function expectError(promise: Promise<unknown>, message: RegExp) {
  await expect(promise).rejects.toThrow(message)
}

const SIX = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3']

/** A night in progress with A1-A3, B1-B3 and any extra players checked in. */
async function liveNight(extra: string[] = []) {
  const g = await setupGroup(db, [...SIX, ...extra])
  const p = (name: string) => g.pid(g.users[name])
  const id = await startNight(db, g.users.admin, g.groupId, [...SIX, ...extra].map(p))
  /** The usual board (A1-A3 on Team A, B1-B3 on Team B), with changes by name. */
  const board = (changes: Record<string, Team | null> = {}): Record<string, Team | null> => ({
    ...Object.fromEntries(SIX.map((name) => [p(name), name[0] as Team])),
    ...Object.fromEntries(Object.entries(changes).map(([name, team]) => [p(name), team])),
  })
  return { ...g, id, p, board }
}

type BoardRow = { player_id: string; team: string | null }
type GameRow = {
  id: string; ordinal: number; team_one: string; team_two: string
  planned_minutes: number; ended_at: Date | null; penalty_winner: string | null
}
type PeriodRow = { ordinal: number; game_id: string; ended_at: Date | null; player_id: string; team: string; is_goalkeeper: boolean }

const boardOf = (user: string, id: string) =>
  selectAs<BoardRow>(db, user, `select player_id, team from match_players where match_id = $1`, [id])
const gamesOf = (user: string, id: string) =>
  selectAs<GameRow>(db, user, `select * from games where match_id = $1 order by ordinal`, [id])
const periodsOf = (user: string, id: string) =>
  selectAs<PeriodRow>(db, user,
    `select s.ordinal, s.game_id, s.ended_at, sp.player_id, sp.team, sp.is_goalkeeper
     from stints s join stint_players sp on sp.stint_id = s.id
     where s.match_id = $1 order by s.ordinal, sp.player_id`, [id])
const goal = (user: string, id: string, scorer: string, assister: string | null = null, gameId: string | null = null) =>
  rpc<{ log_goal: string }>(db, user, 'log_goal', {
    p_match_id: id, p_scorer_id: scorer, p_assister_id: assister, p_game_id: gameId,
  })
const setBoard = (user: string, id: string, board: Record<string, string | null>) =>
  rpc(db, user, 'set_team_board', {
    p_match_id: id,
    p_board: Object.entries(board).map(([player_id, team]) => ({ player_id, team })),
  })
const swap = (user: string, id: string, lineup: [string, string, boolean?][], cont: boolean) =>
  rpc<{ swap_players: string }>(db, user, 'swap_players', {
    p_match_id: id,
    p_lineup: lineup.map(([player_id, team, gk]) => ({ player_id, team, is_goalkeeper: gk ?? false })),
    p_continue: cont,
  })

describe('the team board', () => {
  it('admins put checked-in players on Team A, B or C, or on the bench', async () => {
    const n = await liveNight(['C1', 'Sub'])
    await expectError(setBoard(n.users.A1, n.id, n.board()), /Only group admins/)
    await setBoard(n.users.admin, n.id, n.board({ C1: 'C' }))

    const rows = await boardOf(n.users.A1, n.id)
    const team = (name: string) => rows.find((r) => r.player_id === n.p(name))!.team
    expect(SIX.map(team)).toEqual(['A', 'A', 'A', 'B', 'B', 'B'])
    expect(team('C1')).toBe('C')
    expect(team('Sub')).toBeNull() // left off the list: on the bench

    await expectError(setBoard(n.users.admin, n.id, { [n.p('A1')]: 'D' }), /A, B or C/)
    await expectError(
      setBoard(n.users.admin, n.id, { [n.p('A1')]: 'A', [n.pid(n.users.admin)]: 'B' }),
      /Check in Captain first/,
    )
  })

  it('teams can only be set while the night is on', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const [{ plan_night: id }] = await rpc<{ plan_night: string }>(db, users.admin, 'plan_night', {
      p_group_id: groupId, p_night: nightDetails(),
    })
    await expectError(setBoard(users.admin, id, { [pid(users.Omar)]: 'A' }), /Start the night first/)
  })

  it('someone who left early goes to the bench until they are back', async () => {
    const n = await liveNight()
    await setBoard(n.users.admin, n.id, n.board())
    await rpc(db, n.users.admin, 'check_out', { p_match_id: n.id, p_player_id: n.p('A1') })
    expect((await boardOf(n.users.A1, n.id)).find((r) => r.player_id === n.p('A1'))!.team).toBeNull()
    await expectError(setBoard(n.users.admin, n.id, n.board()), /A1 left early/)

    await rpc(db, n.users.admin, 'check_in', { p_match_id: n.id, p_player_id: n.p('A1') })
    await setBoard(n.users.admin, n.id, n.board())
  })

  it('while a game is on, players on the pitch can only be moved with Swap', async () => {
    const n = await liveNight(['C1'])
    await startGame(db, n.users.admin, n.id, n.board({ C1: 'C' }))
    await expectError(setBoard(n.users.admin, n.id, n.board({ A1: 'B', C1: 'C' })), /only be moved with Swap: A1/)
    await expectError(
      rpc(db, n.users.admin, 'check_out', { p_match_id: n.id, p_player_id: n.p('A1') }),
      /Swap them off first/,
    )
    // The waiting team and the bench can still change.
    await setBoard(n.users.admin, n.id, n.board({ C1: null }))
  })
})

describe('games', () => {
  it('admins start a game between two teams from the board, with goalkeepers', async () => {
    const n = await liveNight()
    await setBoard(n.users.admin, n.id, n.board())
    const start = (by: string, one: string, two: string, k1: string | null = null, k2: string | null = null) =>
      rpc<{ start_game: string }>(db, by, 'start_game', {
        p_match_id: n.id, p_team_one: one, p_team_two: two, p_keeper_one: k1, p_keeper_two: k2,
      })
    await expectError(start(n.users.A1, 'A', 'B'), /Only group admins/)
    await expectError(start(n.users.admin, 'A', 'A'), /two different teams/)
    await expectError(start(n.users.admin, 'A', 'C'), /at least one player/)
    await expectError(start(n.users.admin, 'A', 'B', n.p('B1')), /goalkeeper for Team A/)

    const [{ start_game: gameId }] = await start(n.users.admin, 'A', 'B', n.p('A1'), n.p('B1'))
    const [game] = await gamesOf(n.users.B3, n.id)
    expect(game).toMatchObject({ id: gameId, ordinal: 1, team_one: 'A', team_two: 'B', planned_minutes: 10, ended_at: null })
    const periods = await periodsOf(n.users.B3, n.id)
    expect(periods).toHaveLength(6)
    expect(periods.filter((r) => r.is_goalkeeper).map((r) => r.player_id).sort()).toEqual([n.p('A1'), n.p('B1')].sort())
    expect(periods.every((r) => r.game_id === gameId && r.ended_at === null)).toBe(true)
    await expectError(start(n.users.admin, 'A', 'B'), /already on/)
  })

  it('only admins log goals, into the game that is on', async () => {
    const n = await liveNight(['Sub'])
    await expectError(goal(n.users.admin, n.id, n.p('A1')), /No game is on/)
    const gameId = await startGame(db, n.users.admin, n.id, n.board())
    await expectError(goal(n.users.A1, n.id, n.p('A1')), /Only group admins/)
    await expectError(goal(n.users.admin, n.id, n.p('A1'), n.p('B1')), /scorer's team/)
    await expectError(goal(n.users.admin, n.id, n.p('Sub')), /didn't play/)

    const [{ log_goal: goalId }] = await goal(n.users.admin, n.id, n.p('A1'), n.p('A2'))
    const [row] = await selectAs<{ game_id: string; scoring_team: string; confirmed: boolean }>(
      db, n.users.B1, `select game_id, scoring_team, confirmed from goals where id = $1`, [goalId])
    expect(row).toEqual({ game_id: gameId, scoring_team: 'A', confirmed: true })
    // Players can still dispute it.
    await rpc(db, n.users.B1, 'dispute_goal', { p_goal_id: goalId })
  })

  it('Game over: penalties only for a draw, and they add no goals', async () => {
    const n = await liveNight()
    const over = (by: string, winner: string | null) =>
      rpc(db, by, 'end_game', { p_match_id: n.id, p_penalty_winner: winner })
    await expectError(over(n.users.admin, null), /No game is on/)
    await startGame(db, n.users.admin, n.id, n.board())
    await goal(n.users.admin, n.id, n.p('A1'))
    await expectError(over(n.users.A1, null), /Only group admins/)
    await expectError(over(n.users.admin, 'A'), /only for a draw/)
    await expectError(over(n.users.admin, 'C'), /Team A or Team B/)
    await over(n.users.admin, null)

    const [{ start_game: second }] = await rpc<{ start_game: string }>(db, n.users.admin, 'start_game', {
      p_match_id: n.id, p_team_one: 'A', p_team_two: 'B', p_keeper_one: null, p_keeper_two: null,
    })
    await over(n.users.admin, 'B') // 0-0, and B won the shootout
    const games = await gamesOf(n.users.A1, n.id)
    expect(games.map((g) => [g.ordinal, g.penalty_winner, g.ended_at !== null])).toEqual([[1, null, true], [2, 'B', true]])
    expect(games[1].id).toBe(second)
    expect(await selectAs(db, n.users.A1, `select * from goals where game_id = $1`, [second])).toHaveLength(0)
    expect((await periodsOf(n.users.A1, n.id)).every((r) => r.ended_at !== null)).toBe(true)
  })

  it('swap and continue: the same game, the score carries on, a new lineup period starts', async () => {
    const n = await liveNight()
    const gameId = await startGame(db, n.users.admin, n.id, n.board(), ['A', 'B'], [n.p('A1'), n.p('B1')])
    await goal(n.users.admin, n.id, n.p('A2'))
    // A3 and B3 swap teams.
    const swapped: [string, string, boolean?][] = [
      [n.p('A1'), 'A', true], [n.p('A2'), 'A'], [n.p('B3'), 'A'],
      [n.p('B1'), 'B', true], [n.p('B2'), 'B'], [n.p('A3'), 'B'],
    ]
    await expectError(swap(n.users.A1, n.id, swapped, true), /Only group admins/)
    const [{ swap_players: same }] = await swap(n.users.admin, n.id, swapped, true)
    expect(same).toBe(gameId)

    const periods = await periodsOf(n.users.A1, n.id)
    expect([...new Set(periods.map((r) => r.ordinal))]).toEqual([1, 2])
    expect(periods.filter((r) => r.ordinal === 1).every((r) => r.ended_at !== null)).toBe(true)
    expect(periods.find((r) => r.ordinal === 2 && r.player_id === n.p('A3'))!.team).toBe('B')
    expect(periods.every((r) => r.game_id === gameId)).toBe(true)
    // The team board follows the pitch.
    const board = await boardOf(n.users.A1, n.id)
    expect(board.find((r) => r.player_id === n.p('B3'))!.team).toBe('A')
    expect(board.find((r) => r.player_id === n.p('A3'))!.team).toBe('B')
    // A goal now goes to the new period, in the same game.
    await goal(n.users.admin, n.id, n.p('A3'))
    const goals = await selectAs<{ scoring_team: string }>(
      db, n.users.A1, `select scoring_team from goals where game_id = $1 order by created_at`, [gameId])
    expect(goals.map((g) => g.scoring_team)).toEqual(['A', 'B'])

    await expectError(swap(n.users.admin, n.id, swapped, true), /Nothing changed/)
  })

  it('end game and swap: the game ends with its score and the next starts 0-0 with the new teams', async () => {
    const n = await liveNight()
    const first = await startGame(db, n.users.admin, n.id, n.board())
    await goal(n.users.admin, n.id, n.p('A1'))
    // A1 and B1 swap teams.
    const [{ swap_players: next }] = await swap(n.users.admin, n.id, [
      [n.p('A1'), 'B'], [n.p('A2'), 'A'], [n.p('A3'), 'A'], [n.p('B1'), 'A'], [n.p('B2'), 'B'], [n.p('B3'), 'B'],
    ], false)
    expect(next).not.toBe(first)
    const games = await gamesOf(n.users.A1, n.id)
    expect(games.map((g) => [g.ordinal, g.team_one, g.team_two, g.ended_at === null])).toEqual([
      [1, 'A', 'B', false],
      [2, 'A', 'B', true],
    ])
    expect(await selectAs(db, n.users.A1, `select * from goals where game_id = $1`, [next])).toHaveLength(0)
  })

  it('subs come on from the bench or the waiting team; players taken off go to the bench', async () => {
    const n = await liveNight(['Sub', 'C1'])
    await startGame(db, n.users.admin, n.id, n.board({ C1: 'C' }))
    const rest: [string, string][] = [[n.p('A1'), 'A'], [n.p('A3'), 'A'], [n.p('B1'), 'B'], [n.p('B2'), 'B'], [n.p('B3'), 'B']]
    // Sub comes on for A2.
    await swap(n.users.admin, n.id, [...rest, [n.p('Sub'), 'A']], true)
    let board = await boardOf(n.users.A1, n.id)
    const team = (name: string) => board.find((r) => r.player_id === n.p(name))!.team
    expect([team('Sub'), team('A2')]).toEqual(['A', null])
    // Team C isn't in this game, but C1 can come on for one of the two teams.
    await expectError(swap(n.users.admin, n.id, [...rest, [n.p('C1'), 'C']], true), /Team A or Team B/)
    await swap(n.users.admin, n.id, [...rest, [n.p('C1'), 'A']], true)
    board = await boardOf(n.users.A1, n.id)
    expect([team('C1'), team('Sub')]).toEqual(['A', null])
  })

  it('admins can add a goal forgotten in an earlier game, even after the night', async () => {
    const n = await liveNight(['Sub'])
    const first = await startGame(db, n.users.admin, n.id, n.board())
    await rpc(db, n.users.admin, 'end_game', { p_match_id: n.id, p_penalty_winner: null })
    await startGame(db, n.users.admin, n.id, n.board({ A3: null, Sub: 'A' }))
    await expectError(goal(n.users.admin, n.id, n.p('Sub'), null, first), /didn't play/)
    await goal(n.users.admin, n.id, n.p('A3'), n.p('A1'), first)
    await rpc(db, n.users.admin, 'end_night', { p_match_id: n.id })
    await goal(n.users.admin, n.id, n.p('B1'), null, first)
    const goals = await selectAs<{ scoring_team: string }>(
      db, n.users.A1, `select scoring_team from goals where game_id = $1 order by created_at`, [first])
    expect(goals.map((g) => g.scoring_team)).toEqual(['A', 'B'])

    const other = await liveNight()
    const elsewhere = await startGame(db, other.users.admin, other.id, other.board())
    await expectError(goal(n.users.admin, n.id, n.p('A1'), null, elsewhere), /not part of this night/)
  })

  it('End night and Cancel night stop the game that is on', async () => {
    const n = await liveNight()
    await startGame(db, n.users.admin, n.id, n.board())
    await rpc(db, n.users.admin, 'end_night', { p_match_id: n.id })
    expect((await gamesOf(n.users.A1, n.id))[0].ended_at).not.toBeNull()
    await expectError(setBoard(n.users.admin, n.id, n.board()), /teams and games are final/)

    const c = await liveNight()
    await startGame(db, c.users.admin, c.id, c.board())
    await rpc(db, c.users.admin, 'cancel_night', { p_match_id: c.id, p_reason: 'rain', p_note: null, p_fee: 0 })
    expect((await gamesOf(c.users.A1, c.id))[0].ended_at).not.toBeNull()
  })
})

describe('goalkeepers and security', () => {
  it('players say whether they are happy to play in goal; admins can set it for anyone', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const happy = async (id: string) =>
      (await selectAs<{ happy_in_goal: boolean }>(db, users.admin, `select happy_in_goal from players where id = $1`, [id]))[0]
        .happy_in_goal
    await selectAs(db, users.Omar, `update players set happy_in_goal = true where id = $1`, [pid(users.Omar)])
    expect(await happy(pid(users.Omar))).toBe(true)
    await selectAs(db, users.Omar, `update players set happy_in_goal = true where id = $1`, [pid(users.Ziad)])
    expect(await happy(pid(users.Ziad))).toBe(false) // not Omar's to change
    await selectAs(db, users.admin, `update players set happy_in_goal = true where id = $1`, [pid(users.Ziad)])
    expect(await happy(pid(users.Ziad))).toBe(true)
    await expectError(
      selectAs(db, users.Omar, `update players set group_id = $1 where id = $2`, [groupId, pid(users.Omar)]),
      /permission denied/,
    )
  })

  it('nobody writes games directly, outsiders see none, and helpers stay private', async () => {
    const n = await liveNight()
    await startGame(db, n.users.admin, n.id, n.board())
    await expectError(
      selectAs(db, n.users.admin, `update games set penalty_winner = 'A' where match_id = $1`, [n.id]),
      /permission denied/,
    )
    const stranger = await setupGroup(db)
    expect(await selectAs(db, stranger.users.admin, `select * from games where match_id = $1`, [n.id])).toHaveLength(0)
    await expectError(rpc(db, n.users.admin, 'stop_game', { p_match_id: n.id, p_penalty_winner: null }), /permission denied/)
  })
})
