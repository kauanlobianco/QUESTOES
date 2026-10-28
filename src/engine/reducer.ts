import { GameError } from './errors.js'
import { getQuestion, pickDuelQuestions, pickQuestion } from './questions.js'
import { AREAS, RULES } from './rules.js'
import type {
  AnswerReveal,
  Area,
  Command,
  Ctx,
  DuelResult,
  EndedReason,
  GameEvent,
  MatchState,
  PlayerNo,
  PlayerState,
  Question,
  QuestionKind,
  ReduceResult,
  Slice,
  TurnEndReason,
} from './types.js'

export const SLICES: readonly Slice[] = [...AREAS, 'coringa']

export const other = (p: PlayerNo): PlayerNo => (p === 1 ? 2 : 1)

/** Contexto de uma transição: estado mutável (já clonado) + eventos emitidos. */
interface Tx {
  s: MatchState
  ctx: Ctx
  events: GameEvent[]
  reveal?: AnswerReveal
  spin?: Slice
}

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

export function newPlayer(id: string, name: string): PlayerState {
  const byArea = Object.fromEntries(AREAS.map((a) => [a, { answered: 0, correct: 0 }])) as PlayerState['stats']['byArea']
  return { id, name, charges: 0, crowns: [], stats: { answered: 0, correct: 0, xp: 0, byArea } }
}

/** P1 cria a partida e já joga o primeiro turno; P2 entra depois pelo código. */
export function createMatch(input: { id: string; code: string; creatorId: string; creatorName: string; now: number }): MatchState {
  return {
    id: input.id,
    code: input.code,
    seq: 0,
    status: 'WAITING_OPPONENT',
    phase: 'SPIN',
    endedReason: null,
    winner: null,
    round: 1,
    turnOf: 1,
    players: { 1: newPlayer(input.creatorId, input.creatorName), 2: null },
    crownCause: null,
    turnCrowns: 0,
    current: null,
    lastSpin: null,
    duel: null,
    lastDuel: null,
    usedQuestionIds: [],
    log: [],
    rematch: null,
    createdAt: input.now,
    updatedAt: input.now,
    expiresAt: input.now + RULES.expireAfterMs,
  }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Aplica efeitos do relógio: pergunta com tempo estourado conta como erro e
 * partida parada além de `expiresAt` termina. Idempotente; usar em leituras.
 */
export function settle(prev: MatchState, ctx: Ctx): ReduceResult {
  const tx: Tx = { s: structuredClone(prev), ctx, events: [] }
  runSettle(tx, true)
  return finish(tx, tx.events.length > 0)
}

/** Aplica um comando. Lança GameError se for inválido. */
export function reduce(prev: MatchState, cmd: Command, ctx: Ctx): ReduceResult {
  const tx: Tx = { s: structuredClone(prev), ctx, events: [] }
  // ANSWER trata o próprio atraso para devolver o gabarito ao jogador.
  runSettle(tx, cmd.type !== 'ANSWER')
  if (tx.s.status === 'ENDED') throw new GameError('MATCH_ENDED')

  switch (cmd.type) {
    case 'JOIN':
      join(tx, cmd.by, cmd.name)
      break
    case 'SPIN':
      spin(tx, actor(tx.s, cmd.by))
      break
    case 'ANSWER':
      answer(tx, actor(tx.s, cmd.by), cmd.option)
      break
    case 'CHOOSE_CROWN':
      chooseCrown(tx, actor(tx.s, cmd.by), cmd.area)
      break
    case 'START_DUEL':
      startDuel(tx, actor(tx.s, cmd.by), cmd.requested, cmd.offered)
      break
    case 'DUEL_NEXT':
      duelNext(tx, actor(tx.s, cmd.by))
      break
    case 'RESIGN':
      resign(tx, actor(tx.s, cmd.by))
      break
  }

  touch(tx.s, tx.ctx.now)
  return finish(tx, true)
}

/**
 * Liga uma partida encerrada à revanche. Só a primeira vale: se já existe,
 * devolve a mesma ligação sem mudar nada.
 */
export function linkRematch(prev: MatchState, matchId: string, by: PlayerNo): ReduceResult {
  if (prev.status !== 'ENDED' || !prev.players[2]) throw new GameError('WRONG_PHASE')
  if (prev.rematch) return { state: prev, events: [] }
  const s = structuredClone(prev)
  s.rematch = { matchId, by }
  s.seq = (s.seq ?? 0) + 1
  return { state: s, events: [] }
}

/** Número do jogador (1 ou 2) para um userId, ou null. */
export function playerNoOf(s: Pick<MatchState, 'players'>, userId: string): PlayerNo | null {
  if (s.players[1].id === userId) return 1
  if (s.players[2]?.id === userId) return 2
  return null
}

/** Áreas que o jogador ainda pode conquistar numa pergunta de coroa. */
export function crownChoices(s: Pick<MatchState, 'players'>, no: PlayerNo): Area[] {
  const mine = s.players[no]?.crowns ?? []
  return AREAS.filter((a) => !mine.includes(a))
}

/** Coroas disponíveis para um duelo. Duelo só existe se as duas listas tiverem itens. */
export function duelChoices(s: Pick<MatchState, 'players'>, no: PlayerNo): { requestable: Area[]; offerable: Area[] } {
  const me = s.players[no]
  const opp = s.players[other(no)]
  if (!me || !opp) return { requestable: [], offerable: [] }
  return {
    requestable: opp.crowns.filter((a) => !me.crowns.includes(a)),
    offerable: [...me.crowns],
  }
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

function join(tx: Tx, userId: string, name: string) {
  const { s } = tx
  if (playerNoOf(s, userId)) throw new GameError('ALREADY_JOINED')
  if (s.players[2]) throw new GameError('MATCH_FULL')
  s.players[2] = newPlayer(userId, name)
  s.status = 'ACTIVE'
  emit(tx, { type: 'PLAYER_JOINED', player: 2, at: tx.ctx.now })
}

function spin(tx: Tx, no: PlayerNo) {
  const { s, ctx } = tx
  requireTurn(s, no, 'SPIN')
  const slice = SLICES[Math.floor(ctx.rng() * SLICES.length)] as Slice
  s.lastSpin = slice
  tx.spin = slice
  emit(tx, { type: 'SPUN', player: no, slice, at: ctx.now })
  if (slice === 'coringa') {
    s.phase = 'CROWN_CHOICE'
    s.crownCause = 'CORINGA'
    return
  }
  const q = pickQuestion(ctx.bank, new Set(s.usedQuestionIds), slice, RULES.mechanicFor.NORMAL, ctx.rng)
  // O relógio só começa quando a roleta para na tela.
  serve(tx, 'NORMAL', q, RULES.spinRevealMs)
}

function chooseCrown(tx: Tx, no: PlayerNo, area: Area) {
  const { s, ctx } = tx
  requireTurn(s, no, 'CROWN_CHOICE')
  if (!crownChoices(s, no).includes(area)) throw new GameError('INVALID_CROWN')
  player(s, no).charges = 0
  s.crownCause = null
  const q = pickQuestion(ctx.bank, new Set(s.usedQuestionIds), area, RULES.mechanicFor.CROWN, ctx.rng)
  serve(tx, 'CROWN', q)
}

function startDuel(tx: Tx, no: PlayerNo, requested: Area, offered: Area) {
  const { s, ctx } = tx
  requireTurn(s, no, 'CROWN_CHOICE')
  const { requestable, offerable } = duelChoices(s, no)
  if (requestable.length === 0 || offerable.length === 0) throw new GameError('DUEL_NOT_AVAILABLE')
  if (!requestable.includes(requested) || !offerable.includes(offered)) throw new GameError('INVALID_CROWN')

  player(s, no).charges = 0
  s.crownCause = null
  const questionIds = pickDuelQuestions(ctx.bank, new Set(s.usedQuestionIds), ctx.rng)
  s.usedQuestionIds.push(...questionIds)
  s.duel = {
    kind: 'NORMAL',
    challenger: no,
    challenged: other(no),
    requested,
    offered,
    questionIds,
    answers: { 1: [], 2: [] },
    stage: no,
  }
  s.phase = 'DUEL'
  emit(tx, { type: 'DUEL_STARTED', challenger: no, requested, offered, at: ctx.now })
}

function duelNext(tx: Tx, no: PlayerNo) {
  const { s, ctx } = tx
  requireTurn(s, no, 'DUEL')
  const duel = s.duel
  if (!duel || duel.stage !== no || s.current) throw new GameError('WRONG_PHASE')
  const id = duel.questionIds[duel.answers[no].length]
  if (!id) throw new GameError('WRONG_PHASE')
  serve(tx, 'DUEL', getQuestion(ctx.bank, id))
}

function answer(tx: Tx, no: PlayerNo, option: number | null) {
  const { s } = tx
  if (s.turnOf !== no) throw new GameError('NOT_YOUR_TURN')
  if (!s.current) throw new GameError('WRONG_PHASE')
  const q = getQuestion(tx.ctx.bank, s.current.questionId)
  if (option !== null && (!Number.isInteger(option) || option < 0 || option >= q.options.length)) {
    throw new GameError('INVALID_OPTION')
  }
  resolveAnswer(tx, no, option, q)
}

function resign(tx: Tx, no: PlayerNo) {
  const opp = other(no)
  endGame(tx, tx.s.players[opp] ? opp : null, 'RESIGNED')
}

// ---------------------------------------------------------------------------
// Regras internas
// ---------------------------------------------------------------------------

function runSettle(tx: Tx, timeouts: boolean) {
  const { s, ctx } = tx
  const cur = s.current
  if (timeouts && cur && s.status !== 'ENDED' && ctx.now > cur.servedAt + cur.timeLimitMs + RULES.graceMs) {
    resolveAnswer(tx, s.turnOf, null, getQuestion(ctx.bank, cur.questionId))
    // A inatividade conta a partir do fim do prazo da pergunta.
    touch(s, cur.servedAt + cur.timeLimitMs)
  }
  if (s.status !== 'ENDED' && ctx.now > s.expiresAt) {
    endGame(tx, s.status === 'ACTIVE' ? other(s.turnOf) : null, 'EXPIRED', s.expiresAt)
  }
}

/** option null = tempo esgotado. */
function resolveAnswer(tx: Tx, no: PlayerNo, option: number | null, q: Question) {
  const { s, ctx } = tx
  const cur = s.current!
  const elapsed = Math.max(0, ctx.now - cur.servedAt)
  const timeout = option === null || elapsed > cur.timeLimitMs + RULES.graceMs
  const correct = !timeout && option === q.correctIndex
  const kind: QuestionKind = cur.kind

  const xp = correct ? RULES.xpFor[kind] : 0
  const p = player(s, no)
  p.stats.answered++
  p.stats.byArea[q.area].answered++
  if (correct) {
    p.stats.correct++
    p.stats.byArea[q.area].correct++
    p.stats.xp = (p.stats.xp ?? 0) + xp
  }
  s.current = null
  tx.reveal = {
    questionId: q.id,
    correct,
    timeout,
    correctIndex: q.correctIndex,
    xp,
    feedback: q.feedback,
    optionFeedback: !correct && option !== null ? (q.optionFeedback[option] ?? null) : null,
    explanation: q.explanation,
  }
  emit(tx, { type: 'ANSWERED', player: no, kind, area: q.area, correct, timeout, at: ctx.now })

  const failReason: TurnEndReason = timeout ? 'TIMEOUT' : 'WRONG'

  if (kind === 'NORMAL') {
    if (!correct) return passTurn(tx, failReason)
    p.charges = Math.min(p.charges + 1, RULES.chargesForCrown)
    if (p.charges >= RULES.chargesForCrown) {
      s.phase = 'CROWN_CHOICE'
      s.crownCause = 'CHARGES'
      emit(tx, { type: 'CHARGE_FULL', player: no, at: ctx.now })
    } else {
      s.phase = 'SPIN'
    }
    return
  }

  if (kind === 'CROWN') {
    if (!correct) return passTurn(tx, failReason)
    addCrown(p, q.area)
    s.turnCrowns++
    emit(tx, { type: 'CROWN_WON', player: no, area: q.area, at: ctx.now })
    if (p.crowns.length >= RULES.crownsToWin) return endGame(tx, no, 'CROWNS')
    if (s.round === 1 && s.turnCrowns >= RULES.firstTurnCrownLimit) return passTurn(tx, 'CROWN_LIMIT')
    s.phase = 'SPIN'
    return
  }

  // DUEL
  const duel = s.duel!
  const ms = timeout ? cur.timeLimitMs : Math.min(elapsed, cur.timeLimitMs)
  duel.answers[no].push({ questionId: q.id, correct, ms })
  s.phase = 'DUEL'
  if (duel.answers[no].length < duel.questionIds.length) return

  if (no === duel.challenger) {
    duel.stage = duel.challenged
    if (duel.kind === 'NORMAL') return passTurn(tx, 'DUEL_SENT')
    s.turnOf = duel.challenged
    return
  }
  resolveDuel(tx)
}

function resolveDuel(tx: Tx) {
  const { s, ctx } = tx
  const duel = s.duel!
  const { challenger: a, challenged: b } = duel
  const score = { 1: 0, 2: 0 } as Record<PlayerNo, number>
  const totalMs = { 1: 0, 2: 0 } as Record<PlayerNo, number>
  for (const no of [1, 2] as const) {
    score[no] = duel.answers[no].filter((x) => x.correct).length
    totalMs[no] = duel.answers[no].reduce((sum, x) => sum + x.ms, 0)
  }

  let winner: PlayerNo
  let tieBreak: DuelResult['tieBreak'] = 'NONE'
  if (score[a] !== score[b]) winner = score[a] > score[b] ? a : b
  else if (totalMs[a] !== totalMs[b]) {
    winner = totalMs[a] < totalMs[b] ? a : b
    tieBreak = 'TIME'
  } else {
    winner = b
    tieBreak = 'DEFENDER'
  }

  const result: DuelResult = {
    kind: duel.kind,
    challenger: a,
    challenged: b,
    requested: duel.requested,
    offered: duel.offered,
    winner,
    score,
    totalMs,
    tieBreak,
  }
  s.lastDuel = result
  s.duel = null
  emit(tx, { type: 'DUEL_ENDED', result, at: ctx.now })

  if (duel.kind === 'FINAL') return endGame(tx, winner, 'FINAL_DUEL')

  const loser = other(winner)
  const prize = winner === a ? duel.requested! : duel.offered!
  player(s, loser).crowns = player(s, loser).crowns.filter((c) => c !== prize)
  addCrown(player(s, winner), prize)
  if (player(s, winner).crowns.length >= RULES.crownsToWin) return endGame(tx, winner, 'CROWNS')

  // O desafiado segue para o próprio turno.
  beginTurn(tx)
}

function passTurn(tx: Tx, reason: TurnEndReason) {
  const { s, ctx } = tx
  const from = s.turnOf
  const to = other(from)
  emit(tx, { type: 'TURN_ENDED', player: from, reason, at: ctx.now })
  s.current = null
  s.crownCause = null
  s.turnCrowns = 0
  s.turnOf = to
  if (from === 2) s.round++
  if (s.duel && s.duel.stage === to) {
    s.phase = 'DUEL'
    return
  }
  beginTurn(tx)
}

function beginTurn(tx: Tx) {
  if (tx.s.round > RULES.maxRounds) return endByRounds(tx)
  tx.s.phase = 'SPIN'
}

function endByRounds(tx: Tx) {
  const { s, ctx } = tx
  const c1 = s.players[1].crowns.length
  const c2 = s.players[2]?.crowns.length ?? 0
  if (c1 !== c2) return endGame(tx, c1 > c2 ? 1 : 2, 'ROUNDS')

  const questionIds = pickDuelQuestions(ctx.bank, new Set(s.usedQuestionIds), ctx.rng)
  s.usedQuestionIds.push(...questionIds)
  s.duel = {
    kind: 'FINAL',
    challenger: 1,
    challenged: 2,
    requested: null,
    offered: null,
    questionIds,
    answers: { 1: [], 2: [] },
    stage: 1,
  }
  s.turnOf = 1
  s.phase = 'DUEL'
  emit(tx, { type: 'FINAL_DUEL_STARTED', at: ctx.now })
}

function endGame(tx: Tx, winner: PlayerNo | null, reason: EndedReason, at = tx.ctx.now) {
  const { s } = tx
  s.status = 'ENDED'
  s.phase = 'ENDED'
  s.winner = winner
  s.endedReason = reason
  s.current = null
  s.crownCause = null
  emit(tx, { type: 'GAME_ENDED', winner, reason, at })
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function serve(tx: Tx, kind: QuestionKind, q: Question, delayMs = 0) {
  const { s, ctx } = tx
  s.current = { kind, questionId: q.id, area: q.area, servedAt: ctx.now + delayMs, timeLimitMs: q.timeLimitMs }
  if (kind !== 'DUEL') s.usedQuestionIds.push(q.id)
  s.phase = kind === 'DUEL' ? 'DUEL' : 'QUESTION'
}

function addCrown(p: PlayerState, area: Area) {
  if (!p.crowns.includes(area)) p.crowns.push(area)
}

function actor(s: MatchState, userId: string): PlayerNo {
  const no = playerNoOf(s, userId)
  if (!no) throw new GameError('NOT_A_PLAYER')
  return no
}

function player(s: MatchState, no: PlayerNo): PlayerState {
  const p = s.players[no]
  if (!p) throw new GameError('NOT_A_PLAYER')
  return p
}

function requireTurn(s: MatchState, no: PlayerNo, phase: MatchState['phase']) {
  if (s.turnOf !== no) throw new GameError('NOT_YOUR_TURN')
  if (s.phase !== phase) throw new GameError('WRONG_PHASE')
}

function touch(s: MatchState, at: number) {
  s.updatedAt = at
  s.expiresAt = at + RULES.expireAfterMs
}

function emit(tx: Tx, e: GameEvent) {
  tx.events.push(e)
}

function finish(tx: Tx, changed: boolean): ReduceResult {
  if (changed) tx.s.seq = (tx.s.seq ?? 0) + 1
  // Respostas de duelo ficam fora do log: o rival não pode ver o placar antes de jogar.
  const visible = tx.events.filter((e) => !(e.type === 'ANSWERED' && e.kind === 'DUEL'))
  tx.s.log = [...tx.s.log, ...visible].slice(-RULES.logSize)
  return { state: tx.s, events: tx.events, reveal: tx.reveal, spin: tx.spin }
}
