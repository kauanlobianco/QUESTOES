import { describe, expect, it } from 'vitest'
import { GameError } from './errors'
import { RULES } from './rules'
import { Game, P1, P2, TIME } from './testing'
import { toPublicView } from './view'

function expectError(fn: () => unknown, code: string) {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(GameError)
    expect((e as GameError).code).toBe(code)
    return
  }
  throw new Error(`esperava GameError ${code}`)
}

/** Partida com os dois jogadores e P1 na vez, rodada 2 (sem limite de 1º turno). */
function activeGame() {
  const g = new Game()
  g.join()
  g.miss(1)
  g.miss(2)
  expect(g.state.round).toBe(2)
  return g
}

describe('criação e entrada', () => {
  it('P1 cria e já pode girar antes de P2 entrar', () => {
    const g = new Game()
    expect(g.state.status).toBe('WAITING_OPPONENT')
    expect(g.state.turnOf).toBe(1)
    expect(g.state.phase).toBe('SPIN')
    g.hit(1)
    expect(g.state.players[1].charges).toBe(1)
  })

  it('P2 entra pelo código e a partida fica ativa', () => {
    const g = new Game()
    const r = g.join()
    expect(g.state.status).toBe('ACTIVE')
    expect(g.state.players[2]?.name).toBe('Bia')
    expect(r.events[0]).toMatchObject({ type: 'PLAYER_JOINED', player: 2 })
  })

  it('rejeita terceiro jogador e entrada repetida', () => {
    const g = new Game()
    g.join()
    expectError(() => g.do({ type: 'JOIN', by: 'intruso', name: 'X' }), 'MATCH_FULL')
    expectError(() => g.do({ type: 'JOIN', by: P1, name: 'Ana' }), 'ALREADY_JOINED')
    expectError(() => g.do({ type: 'JOIN', by: P2, name: 'Bia' }), 'ALREADY_JOINED')
  })

  it('P2 não age antes de entrar; partida espera na vez dele', () => {
    const g = new Game()
    g.miss(1)
    expect(g.state.turnOf).toBe(2)
    expect(g.state.status).toBe('WAITING_OPPONENT')
    expectError(() => g.spin(2), 'NOT_A_PLAYER')
    g.join()
    g.spin(2, 'marketing')
    expect(g.state.phase).toBe('QUESTION')
  })

  it('não modifica o estado anterior', () => {
    const g = new Game()
    const before = structuredClone(g.state)
    const prev = g.state
    g.spin(1, 'marketing')
    expect(prev).toEqual(before)
  })
})

describe('roleta e perguntas normais', () => {
  it('fatia de área serve pergunta daquela área', () => {
    const g = new Game()
    const r = g.spin(1, 'lideranca')
    expect(r.spin).toBe('lideranca')
    expect(g.state.phase).toBe('QUESTION')
    expect(g.state.current).toMatchObject({ kind: 'NORMAL', area: 'lideranca', servedAt: g.now + RULES.spinRevealMs, timeLimitMs: TIME.giro })
    expect(g.bank.byId.get(g.state.current!.questionId)!.mechanics).toContain('giro')
    expect(g.state.usedQuestionIds).toContain(g.state.current!.questionId)
  })

  it('fatia Coringa libera escolha de coroa', () => {
    const g = new Game()
    g.spin(1, 'coringa')
    expect(g.state.phase).toBe('CROWN_CHOICE')
    expect(g.state.crownCause).toBe('CORINGA')
    expect(g.state.current).toBeNull()
  })

  it('acerto soma carga e mantém a vez; 3 cargas liberam coroa', () => {
    const g = new Game()
    g.hit(1)
    g.hit(1)
    expect(g.state.players[1].charges).toBe(2)
    expect(g.state.phase).toBe('SPIN')
    const r = g.hit(1)
    expect(g.state.players[1].charges).toBe(3)
    expect(g.state.phase).toBe('CROWN_CHOICE')
    expect(g.state.crownCause).toBe('CHARGES')
    expect(r.events.map((e) => e.type)).toContain('CHARGE_FULL')
  })

  it('erro passa a vez e mantém as cargas', () => {
    const g = new Game()
    g.join()
    g.hit(1)
    const r = g.miss(1)
    expect(r.reveal).toMatchObject({ correct: false, timeout: false })
    expect(r.reveal!.explanation).toMatch(/Explicação/)
    expect(r.reveal!.feedback).toMatch(/Feedback/)
    expect(r.reveal!.optionFeedback).toMatch(/Por que \d está errada/)
    expect(g.state.turnOf).toBe(2)
    expect(g.state.players[1].charges).toBe(1)
    expect(g.state.round).toBe(1)
  })

  it('rodada avança quando P2 encerra o turno', () => {
    const g = activeGame()
    expect(g.state.turnOf).toBe(1)
  })

  it('valida vez, fase e alternativa', () => {
    const g = new Game()
    g.join()
    expectError(() => g.spin(2), 'NOT_YOUR_TURN')
    expectError(() => g.do({ type: 'ANSWER', by: P1, option: 0 }), 'WRONG_PHASE')
    g.spin(1, 'marketing')
    expectError(() => g.spin(1), 'WRONG_PHASE')
    expectError(() => g.do({ type: 'ANSWER', by: P1, option: 4 }), 'INVALID_OPTION')
    expectError(() => g.do({ type: 'ANSWER', by: P1, option: 1.5 }), 'INVALID_OPTION')
  })

  it('registra estatísticas por área', () => {
    const g = new Game()
    g.hit(1, 'operacoes')
    g.hit(1, 'operacoes')
    const s = g.state.players[1].stats
    expect(s.answered).toBe(2)
    expect(s.correct).toBe(2)
    expect(s.byArea.operacoes).toEqual({ answered: 2, correct: 2 })
  })

  it('acerto normal vale o XP do Giro; erro não vale XP', () => {
    const g = new Game()
    g.join()
    const ok = g.hit(1)
    expect(ok.reveal!.xp).toBe(RULES.xpFor.NORMAL)
    const bad = g.miss(1)
    expect(bad.reveal!.xp).toBe(0)
    expect(g.state.players[1].stats.xp).toBe(RULES.xpFor.NORMAL)
  })

  it('partida salva antes do XP passa a somar a partir de zero', () => {
    const g = new Game()
    delete g.state.players[1].stats.xp
    g.hit(1)
    expect(g.state.players[1].stats.xp).toBe(RULES.xpFor.NORMAL)
  })

  it('a pergunta pública traz dificuldade e áreas secundárias, sem gabarito', () => {
    const g = new Game()
    g.spin(1, 'marketing')
    const q = toPublicView(g.state, g.bank).current!
    expect(q.difficulty).toBe(1)
    expect(q.secondaryAreas).toEqual([])
    expect(q).not.toHaveProperty('correctIndex')
  })
})

describe('tempo', () => {
  it('resposta dentro da folga vale', () => {
    const g = new Game()
    g.spin(1, 'financas')
    g.tick(RULES.spinRevealMs + TIME.giro + RULES.graceMs)
    expect(g.right(1).reveal?.correct).toBe(true)
  })

  it('resposta atrasada conta como erro e revela o gabarito', () => {
    const g = new Game()
    g.join()
    g.spin(1, 'financas')
    g.tick(RULES.spinRevealMs + TIME.giro + RULES.graceMs + 1)
    const r = g.right(1)
    expect(r.reveal).toMatchObject({ correct: false, timeout: true })
    expect(g.state.turnOf).toBe(2)
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'TURN_ENDED', reason: 'TIMEOUT' }))
  })

  it('tempo da pergunta só corre depois da roleta', () => {
    const g = new Game()
    g.spin(1, 'financas')
    g.tick(TIME.giro + RULES.graceMs + 1)
    expect(g.right(1).reveal?.correct).toBe(true)
  })

  it('resposta vazia (tempo acabou no cliente) conta como timeout na hora', () => {
    const g = new Game()
    g.join()
    g.spin(1, 'financas')
    g.tick(5000)
    const r = g.do({ type: 'ANSWER', by: P1, option: null })
    expect(r.reveal).toMatchObject({ correct: false, timeout: true })
    expect(g.state.turnOf).toBe(2)
  })

  it('leitura após o prazo encerra o turno de quem sumiu', () => {
    const g = new Game()
    g.join()
    g.spin(1, 'financas')
    g.tick(60_000)
    g.settle()
    expect(g.state.current).toBeNull()
    expect(g.state.turnOf).toBe(2)
    expect(g.state.phase).toBe('SPIN')
  })

  it('settle é idempotente', () => {
    const g = new Game()
    g.join()
    g.spin(1, 'financas')
    g.tick(60_000)
    g.settle()
    const once = structuredClone(g.state)
    g.settle()
    expect(g.state).toEqual(once)
  })

  it('comando de outro jogador também aplica o timeout pendente', () => {
    const g = new Game()
    g.join()
    g.spin(1, 'financas')
    g.tick(60_000)
    g.spin(2, 'marketing')
    expect(g.state.turnOf).toBe(2)
    expect(g.state.current?.area).toBe('marketing')
  })

  it('partida parada além do prazo expira; quem devia jogar perde', () => {
    const g = activeGame()
    g.tick(RULES.expireAfterMs + 1)
    const r = g.settle()
    expect(g.state.status).toBe('ENDED')
    expect(g.state.endedReason).toBe('EXPIRED')
    expect(g.state.winner).toBe(2)
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'GAME_ENDED', reason: 'EXPIRED' }))
    expectError(() => g.spin(1), 'MATCH_ENDED')
  })

  it('convite nunca aceito expira sem vencedor', () => {
    const g = new Game()
    g.miss(1)
    g.tick(RULES.expireAfterMs + 1)
    g.settle()
    expect(g.state.endedReason).toBe('EXPIRED')
    expect(g.state.winner).toBeNull()
  })

  it('cada ação renova o prazo de expiração', () => {
    const g = activeGame()
    g.tick(RULES.expireAfterMs - 1000)
    g.hit(1)
    expect(g.state.expiresAt).toBe(g.now + RULES.expireAfterMs)
  })
})

describe('coroas', () => {
  function toCrownChoice(g: Game, no: 1 | 2) {
    g.spin(no, 'coringa')
    expect(g.state.phase).toBe('CROWN_CHOICE')
  }

  it('acerto de coroa dá o personagem e zera cargas', () => {
    const g = activeGame()
    g.hit(1)
    g.hit(1)
    toCrownChoice(g, 1)
    g.do({ type: 'CHOOSE_CROWN', by: P1, area: 'marketing' })
    expect(g.state.current).toMatchObject({ kind: 'CROWN', area: 'marketing' })
    expect(g.state.players[1].charges).toBe(0)
    const r = g.right(1)
    expect(r.reveal!.xp).toBe(RULES.xpFor.CROWN)
    expect(g.state.players[1].crowns).toEqual(['marketing'])
    expect(g.state.phase).toBe('SPIN')
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'CROWN_WON', area: 'marketing' }))
  })

  it('pergunta de coroa vem da mecânica Coroa, com o tempo dela', () => {
    const g = activeGame()
    toCrownChoice(g, 1)
    g.do({ type: 'CHOOSE_CROWN', by: P1, area: 'estrategia' })
    const q = g.bank.byId.get(g.state.current!.questionId)!
    expect(q.mechanics).toContain('coroa')
    expect(g.state.current?.timeLimitMs).toBe(TIME.coroa)
  })

  it('erro na coroa passa a vez e zera cargas', () => {
    const g = activeGame()
    g.hit(1)
    g.hit(1)
    g.hit(1)
    g.do({ type: 'CHOOSE_CROWN', by: P1, area: 'marketing' })
    g.wrong(1)
    expect(g.state.players[1].crowns).toEqual([])
    expect(g.state.players[1].charges).toBe(0)
    expect(g.state.turnOf).toBe(2)
  })

  it('não permite escolher coroa que já tem', () => {
    const g = activeGame()
    g.setCrowns(1, ['marketing'])
    toCrownChoice(g, 1)
    expectError(() => g.do({ type: 'CHOOSE_CROWN', by: P1, area: 'marketing' }), 'INVALID_CROWN')
  })

  it('no primeiro turno, a 1ª coroa encerra a vez', () => {
    const g = new Game()
    g.join()
    toCrownChoice(g, 1)
    g.do({ type: 'CHOOSE_CROWN', by: P1, area: 'financas' })
    const r = g.right(1)
    expect(g.state.players[1].crowns).toEqual(['financas'])
    expect(g.state.turnOf).toBe(2)
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'TURN_ENDED', reason: 'CROWN_LIMIT' }))
  })

  it('limite também vale para o primeiro turno de P2', () => {
    const g = new Game()
    g.join()
    g.miss(1)
    toCrownChoice(g, 2)
    g.do({ type: 'CHOOSE_CROWN', by: P2, area: 'financas' })
    g.right(2)
    expect(g.state.turnOf).toBe(1)
    expect(g.state.round).toBe(2)
  })

  it('6 coroas vencem a partida', () => {
    const g = activeGame()
    g.setCrowns(1, ['empreendedorismo', 'marketing', 'financas', 'operacoes', 'lideranca'])
    toCrownChoice(g, 1)
    g.do({ type: 'CHOOSE_CROWN', by: P1, area: 'estrategia' })
    const r = g.right(1)
    expect(g.state.status).toBe('ENDED')
    expect(g.state.winner).toBe(1)
    expect(g.state.endedReason).toBe('CROWNS')
    expect(r.events.at(-1)).toMatchObject({ type: 'GAME_ENDED', winner: 1, reason: 'CROWNS' })
  })
})

describe('desistência', () => {
  it('quem desiste perde, mesmo fora da vez', () => {
    const g = activeGame()
    g.do({ type: 'RESIGN', by: P2 })
    expect(g.state.status).toBe('ENDED')
    expect(g.state.endedReason).toBe('RESIGNED')
    expect(g.state.winner).toBe(1)
  })

  it('desistir antes do rival entrar não dá vitória a ninguém', () => {
    const g = new Game()
    g.do({ type: 'RESIGN', by: P1 })
    expect(g.state.winner).toBeNull()
  })
})

describe('visão pública', () => {
  it('nunca expõe gabarito nem explicação', () => {
    const g = activeGame()
    g.spin(1, 'financas')
    const view = toPublicView(g.state, g.bank)
    const q = g.bank.byId.get(g.state.current!.questionId)!
    expect(view.current).toMatchObject({ id: q.id, text: q.text, options: q.options })
    const json = JSON.stringify(view)
    expect(json).not.toContain('correctIndex')
    expect(json).not.toContain(q.explanation)
    expect(json).not.toContain('usedQuestionIds')
  })

  it('log é limitado', () => {
    const g = activeGame()
    for (let i = 0; i < 30; i++) {
      g.miss(g.state.turnOf)
    }
    expect(g.state.log.length).toBeLessThanOrEqual(RULES.logSize)
  })
})
