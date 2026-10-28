import { getQuestion } from './questions.js'
import { RULES } from './rules.js'
import type {
  Area,
  CrownCause,
  DuelResult,
  EndedReason,
  GameEvent,
  MatchState,
  MatchStatus,
  Phase,
  PlayerNo,
  PlayerState,
  QuestionBank,
  QuestionKind,
  RematchLink,
  Slice,
} from './types.js'

/** Pergunta como o cliente a vê: sem gabarito. */
export interface PublicQuestion {
  kind: QuestionKind
  id: string
  area: Area
  /** 1–2 fácil, 3 média, 4+ difícil. */
  difficulty: number
  secondaryAreas: Area[]
  scenario: { title: string; text: string } | null
  text: string
  options: string[]
  servedAt: number
  timeLimitMs: number
}

export interface PublicDuel {
  kind: 'NORMAL' | 'FINAL'
  challenger: PlayerNo
  challenged: PlayerNo
  requested: Area | null
  offered: Area | null
  stage: PlayerNo
  total: number
  /** Só a quantidade respondida; acertos ficam ocultos até o fim. */
  answered: Record<PlayerNo, number>
}

/** Estado público da partida, seguro para os dois jogadores. */
export interface MatchView {
  id: string
  code: string
  seq: number
  status: MatchStatus
  phase: Phase
  endedReason: EndedReason | null
  winner: PlayerNo | null
  round: number
  maxRounds: number
  turnOf: PlayerNo
  players: { 1: PlayerState; 2: PlayerState | null }
  crownCause: CrownCause | null
  lastSpin: Slice | null
  current: PublicQuestion | null
  duel: PublicDuel | null
  lastDuel: DuelResult | null
  log: GameEvent[]
  rematch: RematchLink | null
  updatedAt: number
  expiresAt: number
}

export function toPublicView(s: MatchState, bank: QuestionBank): MatchView {
  let current: PublicQuestion | null = null
  if (s.current) {
    const q = getQuestion(bank, s.current.questionId)
    current = {
      kind: s.current.kind,
      id: q.id,
      area: q.area,
      difficulty: q.difficulty,
      secondaryAreas: [...(q.secondaryAreas ?? [])],
      scenario: q.scenario && { ...q.scenario },
      text: q.text,
      options: [...q.options],
      servedAt: s.current.servedAt,
      timeLimitMs: s.current.timeLimitMs,
    }
  }

  const duel: PublicDuel | null = s.duel && {
    kind: s.duel.kind,
    challenger: s.duel.challenger,
    challenged: s.duel.challenged,
    requested: s.duel.requested,
    offered: s.duel.offered,
    stage: s.duel.stage,
    total: s.duel.questionIds.length,
    answered: { 1: s.duel.answers[1].length, 2: s.duel.answers[2].length },
  }

  return {
    id: s.id,
    code: s.code,
    seq: s.seq ?? 0,
    status: s.status,
    phase: s.phase,
    endedReason: s.endedReason,
    winner: s.winner,
    round: s.round,
    maxRounds: RULES.maxRounds,
    turnOf: s.turnOf,
    players: structuredClone(s.players),
    crownCause: s.crownCause,
    lastSpin: s.lastSpin,
    current,
    duel,
    lastDuel: s.lastDuel,
    log: structuredClone(s.log),
    rematch: s.rematch ? { ...s.rematch } : null,
    updatedAt: s.updatedAt,
    expiresAt: s.expiresAt,
  }
}
