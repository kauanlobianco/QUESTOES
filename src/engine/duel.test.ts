import { describe, expect, it } from 'vitest'
import { GameError } from './errors'
import { duelChoices } from './reducer'
import { AREAS, RULES } from './rules'
import { Game, P1, P2, TIME } from './testing'
import { toPublicView } from './view'

const ALL_RIGHT = [true, true, true, true, true, true]
const FOUR_RIGHT = [true, true, true, true, false, false]
const TWO_RIGHT = [true, true, false, false, false, false]

/** P1 com Finanças, P2 com Marketing; P1 na vez com escolha de coroa aberta. */
function readyToDuel() {
  const g = new Game()
  g.join()
  g.miss(1)
  g.miss(2)
  g.setCrowns(1, ['financas'])
  g.setCrowns(2, ['marketing'])
  g.spin(1, 'coringa')
  return g
}

function startDuel(g: Game) {
  return g.do({ type: 'START_DUEL', by: P1, requested: 'marketing', offered: 'financas' })
}

describe('duelo', () => {
  it('opções: pedir coroa do rival que não tenho, apostar uma minha', () => {
    const g = readyToDuel()
    g.setCrowns(1, ['financas', 'operacoes'])
    g.setCrowns(2, ['marketing', 'operacoes'])
    expect(duelChoices(g.state, 1)).toEqual({ requestable: ['marketing'], offerable: ['financas', 'operacoes'] })
  })

  it('indisponível se o rival não tem coroa nova para mim', () => {
    const g = readyToDuel()
    g.setCrowns(2, [])
    expect(() => startDuel(g)).toThrow(GameError)
    try {
      startDuel(g)
    } catch (e) {
      expect((e as GameError).code).toBe('DUEL_NOT_AVAILABLE')
    }
  })

  it('indisponível sem coroa própria para apostar', () => {
    const g = readyToDuel()
    g.setCrowns(1, [])
    expect(() => g.do({ type: 'START_DUEL', by: P1, requested: 'marketing', offered: 'financas' })).toThrow(
      'DUEL_NOT_AVAILABLE',
    )
  })

  it('rejeita aposta inválida', () => {
    const g = readyToDuel()
    expect(() => g.do({ type: 'START_DUEL', by: P1, requested: 'lideranca', offered: 'financas' })).toThrow('INVALID_CROWN')
    expect(() => g.do({ type: 'START_DUEL', by: P1, requested: 'marketing', offered: 'lideranca' })).toThrow('INVALID_CROWN')
  })

  it('6 perguntas de duelo, uma por área, sem repetir', () => {
    const g = readyToDuel()
    startDuel(g)
    const duel = g.state.duel!
    expect(duel.questionIds).toHaveLength(6)
    const qs = duel.questionIds.map((id) => g.bank.byId.get(id)!)
    expect(new Set(qs.map((q) => q.area))).toEqual(new Set(AREAS))
    expect(qs.every((q) => q.mechanics.includes('duelo'))).toBe(true)
    expect(g.state.players[1].charges).toBe(0)
  })

  it('fluxo: desafiante responde, vez passa, desafiado responde e segue o turno', () => {
    const g = readyToDuel()
    startDuel(g)
    expect(g.state.phase).toBe('DUEL')
    expect(g.state.current).toBeNull()

    g.playDuel(1, FOUR_RIGHT)
    expect(g.state.turnOf).toBe(2)
    expect(g.state.phase).toBe('DUEL')
    expect(g.state.duel!.stage).toBe(2)
    expect(g.state.round).toBe(2)

    g.playDuel(2, TWO_RIGHT)
    expect(g.state.duel).toBeNull()
    expect(g.state.lastDuel).toMatchObject({ winner: 1, score: { 1: 4, 2: 2 }, tieBreak: 'NONE' })
    expect(g.state.players[1].crowns.sort()).toEqual(['financas', 'marketing'])
    expect(g.state.players[2]!.crowns).toEqual([])
    expect(g.state.turnOf).toBe(2)
    expect(g.state.phase).toBe('SPIN')
  })

  it('defensor vence e leva a coroa apostada', () => {
    const g = readyToDuel()
    startDuel(g)
    g.playDuel(1, TWO_RIGHT)
    g.playDuel(2, FOUR_RIGHT)
    expect(g.state.lastDuel?.winner).toBe(2)
    expect(g.state.players[1].crowns).toEqual([])
    expect(g.state.players[2]!.crowns.sort()).toEqual(['financas', 'marketing'])
  })

  it('defensor que já tem a coroa apostada só a tira do desafiante', () => {
    const g = readyToDuel()
    g.setCrowns(1, ['financas'])
    g.setCrowns(2, ['marketing', 'financas'])
    startDuel(g)
    g.playDuel(1, TWO_RIGHT)
    g.playDuel(2, FOUR_RIGHT)
    expect(g.state.players[1].crowns).toEqual([])
    expect(g.state.players[2]!.crowns.sort()).toEqual(['financas', 'marketing'])
  })

  it('empate em acertos: menor tempo total vence', () => {
    const g = readyToDuel()
    startDuel(g)
    g.playDuel(1, FOUR_RIGHT, 3000)
    g.playDuel(2, FOUR_RIGHT, 2000)
    expect(g.state.lastDuel).toMatchObject({ winner: 2, tieBreak: 'TIME', totalMs: { 1: 18000, 2: 12000 } })
  })

  it('empate total: defensor vence', () => {
    const g = readyToDuel()
    startDuel(g)
    g.playDuel(1, FOUR_RIGHT, 2000)
    g.playDuel(2, FOUR_RIGHT, 2000)
    expect(g.state.lastDuel).toMatchObject({ winner: 2, tieBreak: 'DEFENDER' })
  })

  it('timeout no duelo conta erro com tempo máximo e o duelo segue', () => {
    const g = readyToDuel()
    startDuel(g)
    g.do({ type: 'DUEL_NEXT', by: P1 })
    g.tick(TIME.duelo + RULES.graceMs + 1)
    g.settle()
    expect(g.state.duel!.answers[1]).toEqual([expect.objectContaining({ correct: false, ms: TIME.duelo })])
    expect(g.state.phase).toBe('DUEL')
    expect(g.state.turnOf).toBe(1)
  })

  it('não serve nova pergunta com outra pendente nem fora da vez', () => {
    const g = readyToDuel()
    startDuel(g)
    g.do({ type: 'DUEL_NEXT', by: P1 })
    expect(() => g.do({ type: 'DUEL_NEXT', by: P1 })).toThrow('WRONG_PHASE')
    expect(() => g.do({ type: 'DUEL_NEXT', by: P2 })).toThrow('NOT_YOUR_TURN')
  })

  it('placar do desafiante fica oculto do desafiado', () => {
    const g = readyToDuel()
    startDuel(g)
    g.playDuel(1, ALL_RIGHT)
    const view = toPublicView(g.state, g.bank)
    expect(view.duel).toMatchObject({ stage: 2, total: 6, answered: { 1: 6, 2: 0 } })
    expect(JSON.stringify(view.duel)).not.toContain('correct')
    expect(view.log.some((e) => e.type === 'ANSWERED' && e.kind === 'DUEL')).toBe(false)
  })

  it('duelo que completa 6 coroas vence a partida', () => {
    const g = readyToDuel()
    g.setCrowns(1, ['empreendedorismo', 'financas', 'operacoes', 'lideranca', 'estrategia'])
    g.setCrowns(2, ['marketing'])
    g.do({ type: 'START_DUEL', by: P1, requested: 'marketing', offered: 'financas' })
    g.playDuel(1, ALL_RIGHT)
    g.playDuel(2, TWO_RIGHT)
    expect(g.state.status).toBe('ENDED')
    expect(g.state).toMatchObject({ winner: 1, endedReason: 'CROWNS' })
  })
})

describe('limite de rodadas', () => {
  /** Última rodada, vez de P2. */
  function lastRound() {
    const g = new Game()
    g.join()
    g.miss(1)
    g.state.round = RULES.maxRounds
    return g
  }

  it('mais coroas vence ao fim da última rodada', () => {
    const g = lastRound()
    g.setCrowns(1, ['financas', 'marketing'])
    g.setCrowns(2, ['lideranca'])
    const r = g.miss(2)
    expect(g.state).toMatchObject({ status: 'ENDED', winner: 1, endedReason: 'ROUNDS' })
    expect(r.events.at(-1)).toMatchObject({ type: 'GAME_ENDED', reason: 'ROUNDS' })
  })

  it('empate leva ao duelo final: P1 responde, depois P2', () => {
    const g = lastRound()
    g.setCrowns(1, ['financas'])
    g.setCrowns(2, ['lideranca'])
    const r = g.miss(2)
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'FINAL_DUEL_STARTED' }))
    expect(g.state).toMatchObject({ phase: 'DUEL', turnOf: 1, status: 'ACTIVE' })
    expect(g.state.duel).toMatchObject({ kind: 'FINAL', stage: 1 })

    g.playDuel(1, TWO_RIGHT)
    expect(g.state.turnOf).toBe(2)
    expect(g.state.round).toBe(RULES.maxRounds + 1)

    g.playDuel(2, FOUR_RIGHT)
    expect(g.state).toMatchObject({ status: 'ENDED', winner: 2, endedReason: 'FINAL_DUEL' })
  })

  it('duelo pendente na virada adia o limite até ser resolvido', () => {
    const g = lastRound()
    g.setCrowns(1, ['financas', 'marketing'])
    g.setCrowns(2, ['lideranca'])
    g.spin(2, 'coringa')
    g.do({ type: 'START_DUEL', by: P2, requested: 'financas', offered: 'lideranca' })
    g.playDuel(2, ALL_RIGHT)
    expect(g.state).toMatchObject({ status: 'ACTIVE', phase: 'DUEL', turnOf: 1 })

    g.playDuel(1, TWO_RIGHT)
    // P2 roubou Finanças: 1×2 em coroas → P2 vence por rodadas.
    expect(g.state).toMatchObject({ status: 'ENDED', winner: 2, endedReason: 'ROUNDS' })
  })
})
