// Utilitários de teste e simulação. Não importar em código de produção.
import { createBank } from './questions'
import { SLICES, createMatch, reduce, settle } from './reducer'
import { seededRng } from './rng'
import { AREAS } from './rules'
import type { Area, Command, Ctx, MatchState, Mechanic, PlayerNo, Question, QuestionBank, ReduceResult, Slice } from './types'

export const P1 = 'user-ana'
export const P2 = 'user-bia'
export const T0 = 1_700_000_000_000

/** Tempo de cada mecânica no banco real. */
export const TIME: Record<Mechanic, number> = { duelo: 20_000, giro: 30_000, coroa: 45_000 }

/** 6 áreas × 3 mecânicas × 4 perguntas; gabarito varia por índice. */
export function fixtureBank(perMechanic = 4): QuestionBank {
  const qs: Question[] = []
  for (const area of AREAS) {
    for (const mechanic of ['duelo', 'giro', 'coroa'] as Mechanic[]) {
      for (let i = 0; i < perMechanic; i++) {
        qs.push({
          id: `${area}-${mechanic}-${i}`,
          area,
          difficulty: mechanic === 'coroa' ? 3 : 1,
          secondaryAreas: [],
          mechanics: [mechanic],
          timeLimitMs: TIME[mechanic],
          scenario: mechanic === 'coroa' ? { title: 'Caso', text: `Cenário ${area} ${i}` } : null,
          text: `Pergunta ${area} ${mechanic} ${i}`,
          options: ['A', 'B', 'C', 'D'],
          correctIndex: i % 4,
          feedback: `Feedback ${area}-${mechanic}-${i}`,
          explanation: `Explicação secreta ${area}-${mechanic}-${i}`,
          optionFeedback: [0, 1, 2, 3].map((o) => (o === i % 4 ? null : `Por que ${o} está errada`)),
        })
      }
    }
  }
  return createBank(qs)
}

/** Partida controlável: relógio manual, roleta forçável. */
export class Game {
  state: MatchState
  now = T0
  private queue: number[] = []
  private base: () => number

  constructor(
    readonly bank: QuestionBank = fixtureBank(),
    seed = 1,
  ) {
    this.base = seededRng(seed)
    this.state = createMatch({ id: 'm1', code: 'ABC123', creatorId: P1, creatorName: 'Ana', now: this.now })
  }

  ctx(): Ctx {
    return { now: this.now, bank: this.bank, rng: () => this.queue.shift() ?? this.base() }
  }

  do(cmd: Command): ReduceResult {
    const r = reduce(this.state, cmd, this.ctx())
    this.state = r.state
    return r
  }

  settle(): ReduceResult {
    const r = settle(this.state, this.ctx())
    this.state = r.state
    return r
  }

  tick(ms: number) {
    this.now += ms
  }

  id(no: PlayerNo) {
    return no === 1 ? P1 : P2
  }

  join() {
    return this.do({ type: 'JOIN', by: P2, name: 'Bia' })
  }

  spin(no: PlayerNo, slice?: Slice) {
    if (slice) this.queue.push((SLICES.indexOf(slice) + 0.5) / SLICES.length)
    return this.do({ type: 'SPIN', by: this.id(no) })
  }

  correctOption(): number {
    const cur = this.state.current
    if (!cur) throw new Error('sem pergunta servida')
    return this.bank.byId.get(cur.questionId)!.correctIndex
  }

  right(no: PlayerNo) {
    return this.do({ type: 'ANSWER', by: this.id(no), option: this.correctOption() })
  }

  wrong(no: PlayerNo) {
    return this.do({ type: 'ANSWER', by: this.id(no), option: (this.correctOption() + 1) % 4 })
  }

  /** Gira na área e acerta. */
  hit(no: PlayerNo, area: Area = 'financas') {
    this.spin(no, area)
    return this.right(no)
  }

  /** Gira na área e erra (passa a vez). */
  miss(no: PlayerNo, area: Area = 'financas') {
    this.spin(no, area)
    return this.wrong(no)
  }

  /** Responde o próximo bloco de perguntas de duelo do jogador. */
  playDuel(no: PlayerNo, pattern: boolean[], msEach = 1000) {
    for (const ok of pattern) {
      this.do({ type: 'DUEL_NEXT', by: this.id(no) })
      this.tick(msEach)
      if (ok) this.right(no)
      else this.wrong(no)
    }
  }

  setCrowns(no: PlayerNo, crowns: Area[]) {
    this.state.players[no]!.crowns = [...crowns]
  }
}
