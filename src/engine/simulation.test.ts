// Partidas completas com bots usando o banco real de perguntas.
import { describe, expect, it } from 'vitest'
import questions from '../../server/questions.json'
import { createBank, pickQuestion } from './questions'
import { crownChoices, duelChoices } from './reducer'
import { seededRng } from './rng'
import { AREAS, RULES } from './rules'
import { Game } from './testing'
import type { Question } from './types'
import { toPublicView } from './view'

const bank = createBank(questions as Question[])

/** Joga até o fim com bots que acertam `accuracy` das perguntas. */
function simulate(seed: number, accuracy: number) {
  const g = new Game(bank, seed)
  const bot = seededRng(seed * 7919)
  g.join()
  let steps = 0

  while (g.state.status !== 'ENDED') {
    if (++steps > 5000) throw new Error('partida não terminou')
    const s = g.state
    const no = s.turnOf
    const by = g.id(no)
    g.tick(Math.floor(bot() * 8000))

    switch (s.phase) {
      case 'SPIN':
        g.do({ type: 'SPIN', by })
        break
      case 'QUESTION':
        if (bot() < accuracy) g.right(no)
        else g.wrong(no)
        break
      case 'CROWN_CHOICE': {
        const { requestable, offerable } = duelChoices(s, no)
        if (requestable.length && offerable.length && bot() < 0.3) {
          g.do({ type: 'START_DUEL', by, requested: requestable[0]!, offered: offerable[0]! })
        } else {
          g.do({ type: 'CHOOSE_CROWN', by, area: crownChoices(s, no)[0]! })
        }
        break
      }
      case 'DUEL':
        if (!s.current) g.do({ type: 'DUEL_NEXT', by })
        else if (bot() < accuracy) g.right(no)
        else g.wrong(no)
        break
    }

    // Invariantes a cada passo.
    for (const p of [g.state.players[1], g.state.players[2]!]) {
      if (new Set(p.crowns).size !== p.crowns.length) throw new Error('coroa duplicada')
      if (p.crowns.length > RULES.crownsToWin) throw new Error('coroas demais')
      if (p.charges > RULES.chargesForCrown) throw new Error('cargas demais')
    }
    if (steps % 25 === 0 && JSON.stringify(toPublicView(g.state, bank)).includes('correctIndex')) {
      throw new Error('gabarito vazou na visão pública')
    }
  }
  return { state: g.state, steps }
}

describe('simulação com banco real', () => {
  it('banco tem pelo menos 50 perguntas por área, com áreas secundárias válidas', () => {
    for (const area of AREAS) expect(bank.all.filter((q) => q.area === area).length).toBeGreaterThanOrEqual(50)
    for (const q of bank.all) for (const a of q.secondaryAreas) expect(AREAS).toContain(a)
  })

  it('cada área tem perguntas de Giro, Coroa e Duelo, com tempo e feedback', () => {
    for (const area of AREAS) {
      const qs = bank.all.filter((q) => q.area === area)
      for (const m of ['giro', 'coroa', 'duelo'] as const) expect(qs.filter((q) => q.mechanics.includes(m)).length).toBeGreaterThanOrEqual(6)
    }
    for (const q of bank.all) {
      expect(q.options).toHaveLength(4)
      expect(q.timeLimitMs).toBeGreaterThanOrEqual(10_000)
      expect(q.feedback.length).toBeGreaterThan(0)
      expect(q.optionFeedback[q.correctIndex]).toBeNull()
    }
  })

  it('partidas terminam com vencedor e motivo válidos', () => {
    const reasons = new Map<string, number>()
    for (let seed = 1; seed <= 45; seed++) {
      const accuracy = [0.35, 0.6, 0.85][seed % 3]!
      const { state } = simulate(seed, accuracy)
      expect(state.status).toBe('ENDED')
      expect([1, 2]).toContain(state.winner)
      reasons.set(state.endedReason!, (reasons.get(state.endedReason!) ?? 0) + 1)
    }
    // Bots bons ganham por coroas; ruins chegam ao limite de rodadas.
    expect(reasons.get('CROWNS')).toBeGreaterThan(0)
    expect((reasons.get('ROUNDS') ?? 0) + (reasons.get('FINAL_DUEL') ?? 0)).toBeGreaterThan(0)
  }, 30_000)

  it('não repete pergunta enquanto houver inédita da área', () => {
    const used = new Set<string>()
    const rng = seededRng(3)
    for (let i = 0; i < 50; i++) used.add(pickQuestion(bank, used, 'marketing', null, rng).id)
    expect(used.size).toBe(50)
  })
})
