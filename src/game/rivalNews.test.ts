import { describe, expect, it } from 'vitest'
import type { GameEvent, MatchView } from '../engine'
import { freshRivalEvents, handsTurnTo, latestAt, turnSummary } from './rivalNews'

const name = (a: string) => a.toUpperCase()

// Ana (1) cria e joga; Bia (2) entra depois.
const anaTurn: GameEvent[] = [
  { type: 'SPUN', player: 1, slice: 'marketing', at: 10 },
  { type: 'ANSWERED', player: 1, kind: 'NORMAL', area: 'marketing', correct: true, timeout: false, at: 11 },
  { type: 'SPUN', player: 1, slice: 'financas', at: 12 },
  { type: 'ANSWERED', player: 1, kind: 'NORMAL', area: 'financas', correct: false, timeout: false, at: 13 },
  { type: 'TURN_ENDED', player: 1, reason: 'WRONG', at: 13 },
]
const joined: GameEvent = { type: 'PLAYER_JOINED', player: 2, at: 20 }

const view = (log: GameEvent[], turnOf: 1 | 2 = 2) =>
  ({ status: 'ACTIVE', turnOf, log, players: { 1: { name: 'Ana' }, 2: { name: 'Bia' } } }) as unknown as MatchView

describe('novidades do rival', () => {
  it('sem cursor: quem acabou de entrar vê o turno do rival', () => {
    const log = [...anaTurn, joined]
    const fresh = freshRivalEvents(log, 2, null)
    expect(fresh).toEqual(anaTurn)
    expect(handsTurnTo(view(log), 2, fresh)).toBe(true)
    expect(turnSummary(view(log), 2, fresh, name)).toEqual(['Ana acertou 1 de 2 perguntas.', 'Errou uma de FINANCAS.'])
  })

  it('com cursor: só o que veio depois', () => {
    const log = [...anaTurn, joined, { type: 'SPUN', player: 2, slice: 'coringa', at: 30 } as GameEvent]
    expect(freshRivalEvents(log, 1, 13)).toEqual(log.slice(5))
    expect(freshRivalEvents(log, 1, 20)).toEqual(log.slice(6))
    expect(freshRivalEvents(log, 1, latestAt(log))).toEqual([])
  })

  it('sem cursor: ignora o que veio antes da minha última jogada', () => {
    const log: GameEvent[] = [...anaTurn, joined, { type: 'TURN_ENDED', player: 2, reason: 'TIMEOUT', at: 40 }]
    expect(freshRivalEvents(log, 2, null)).toEqual([])
    expect(freshRivalEvents(log, 1, null)).toEqual(log.slice(5))
  })

  it('duelo enviado e coroa ganha entram no resumo', () => {
    const log: GameEvent[] = [
      { type: 'CROWN_WON', player: 1, area: 'lideranca', at: 50 },
      { type: 'DUEL_STARTED', challenger: 1, requested: 'marketing', offered: 'lideranca', at: 51 },
      { type: 'TURN_ENDED', player: 1, reason: 'DUEL_SENT', at: 52 },
    ]
    expect(turnSummary(view(log), 2, log, name)).toEqual([
      'Conquistou LIDERANCA.',
      'Te desafiou para um duelo: quer MARKETING e aposta LIDERANCA.',
    ])
  })

  it('não é a vez de quem espera enquanto o rival ainda joga', () => {
    const log = anaTurn.slice(0, 2)
    expect(handsTurnTo(view(log, 1), 2, freshRivalEvents(log, 2, null))).toBe(false)
  })
})
