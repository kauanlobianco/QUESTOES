import { describe, expect, it } from 'vitest'
import { RULES, seededRng, type MatchView } from '../src/engine'
import type { ApiResult, ClientCommand } from '../src/game/protocol'
import { createBankFromFile } from './bank'
import { memoryRepo, type MatchRepo } from './repo'
import { ApiError, createGameService } from './service'

const ANA = '11111111-1111-4111-8111-111111111111'
const BIA = '22222222-2222-4222-8222-222222222222'
const EVE = '33333333-3333-4333-8333-333333333333'
const bank = createBankFromFile()

function setup(repo: MatchRepo = memoryRepo(), codes?: string[]) {
  const clock = { now: 1_800_000_000_000 }
  let n = 0
  const service = createGameService({
    repo,
    bank,
    now: () => clock.now,
    rng: seededRng(7),
    newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    newCode: codes ? () => codes.shift() ?? 'ZZZZZZ' : undefined,
  })
  return { service, repo, clock }
}

async function expectApiError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(ApiError)
  await expect(p).rejects.toMatchObject({ code })
}

const correct = (v: MatchView) => bank.byId.get(v.current!.id)!.correctIndex

async function startedMatch() {
  const ctx = setup()
  const created = await ctx.service.create(ANA, 'Ana')
  await ctx.service.join(BIA, created.view.code, 'Bia')
  return { ...ctx, id: created.view.id, code: created.view.code }
}

describe('criar e entrar', () => {
  it('cria partida com o criador como P1, sem gabarito na resposta', async () => {
    const { service } = setup()
    const r = await service.create(ANA, 'Ana')
    expect(r.view).toMatchObject({ status: 'WAITING_OPPONENT', turnOf: 1, players: { 1: { id: ANA, name: 'Ana' }, 2: null } })
    expect(r.view.code).toMatch(/^[A-Z0-9]{6}$/)
    expect(typeof r.now).toBe('number')
  })

  it('sorteia outro código se colidir', async () => {
    const { service } = setup(memoryRepo(), ['AAAAAA', 'AAAAAA', 'BBBBBB'])
    expect((await service.create(ANA, 'Ana')).view.code).toBe('AAAAAA')
    expect((await service.create(BIA, 'Bia')).view.code).toBe('BBBBBB')
  })

  it('prévia do convite para quem ainda não entrou', async () => {
    const { service } = setup()
    const { view } = await service.create(ANA, 'Ana')
    expect(await service.peek(BIA, view.code.toLowerCase())).toMatchObject({ matchId: view.id, hostName: 'Ana', full: false, isPlayer: false })
    expect(await service.peek(ANA, view.code)).toMatchObject({ isPlayer: true })
  })

  it('entrar é idempotente; terceiro jogador é barrado', async () => {
    const { service, code, id } = await startedMatch()
    const again = await service.join(BIA, code, 'Outro nome')
    expect(again.view.players[2]).toMatchObject({ id: BIA, name: 'Bia' })
    expect(again.view.id).toBe(id)
    await expectApiError(service.join(EVE, code, 'Eve'), 'MATCH_FULL')
    await expectApiError(service.join(EVE, 'XXXXXX', 'Eve'), 'NOT_FOUND')
  })

  it('só jogadores leem a partida', async () => {
    const { service, id } = await startedMatch()
    expect((await service.get(BIA, id)).view.status).toBe('ACTIVE')
    await expectApiError(service.get(EVE, id), 'NOT_A_PLAYER')
    await expectApiError(service.command(EVE, id, { type: 'SPIN' }), 'NOT_A_PLAYER')
  })
})

describe('jogadas', () => {
  it('jogador da vez gira; o outro é barrado', async () => {
    const { service, id } = await startedMatch()
    await expectApiError(service.command(BIA, id, { type: 'SPIN' }), 'NOT_YOUR_TURN')
    const r = await service.command(ANA, id, { type: 'SPIN' })
    expect(r.spin).toBeDefined()
    expect(JSON.stringify(r.view)).not.toContain('correctIndex')
  })

  it('timeout é gravado mesmo quando o comando seguinte falha', async () => {
    const { service, repo, clock, id } = await startedMatch()
    let r = await service.command(ANA, id, { type: 'SPIN' })
    while (r.view.phase !== 'QUESTION') {
      // Coringa: escolhe coroa para ter uma pergunta servida.
      r = await service.command(ANA, id, { type: 'CHOOSE_CROWN', area: 'financas' })
    }
    clock.now += RULES.spinRevealMs + 45_000 + RULES.graceMs + 1
    await expectApiError(service.command(ANA, id, { type: 'SPIN' }), 'NOT_YOUR_TURN')
    const stored = await repo.load({ id })
    expect(stored?.state.turnOf).toBe(2)
    expect(stored?.version).toBeGreaterThan(3)
  })

  it('repete a gravação quando outra escrita chega antes', async () => {
    const base = memoryRepo()
    let failures = 1
    const flaky: MatchRepo = {
      ...base,
      commit: async (...args) => (failures-- > 0 ? false : base.commit(...args)),
    }
    const { service } = setup(flaky)
    const { view } = await service.create(ANA, 'Ana')
    await expect(service.command(ANA, view.id, { type: 'SPIN' })).resolves.toHaveProperty('spin')
  })

  it('desiste após conflitos seguidos', async () => {
    const base = memoryRepo()
    const { service } = setup({ ...base, commit: async () => false })
    const { view } = await service.create(ANA, 'Ana')
    await expectApiError(service.command(ANA, view.id, { type: 'SPIN' }), 'CONFLICT')
  })

  it('partida completa entre dois usuários pela API', async () => {
    const { service, id } = await startedMatch()
    const users = { 1: ANA, 2: BIA } as const
    const bot = seededRng(99)
    let view = (await service.get(ANA, id)).view
    for (let step = 0; view.status !== 'ENDED'; step++) {
      if (step > 3000) throw new Error('não terminou')
      const by = users[view.turnOf]
      let cmd: ClientCommand
      if (view.phase === 'SPIN') cmd = { type: 'SPIN' }
      else if (view.phase === 'CROWN_CHOICE') {
        const mine = view.players[view.turnOf]!.crowns
        cmd = { type: 'CHOOSE_CROWN', area: (['empreendedorismo', 'marketing', 'financas', 'operacoes', 'lideranca', 'estrategia'] as const).find((a) => !mine.includes(a))! }
      } else if (view.phase === 'DUEL' && !view.current) cmd = { type: 'DUEL_NEXT' }
      else cmd = { type: 'ANSWER', option: bot() < 0.8 ? correct(view) : (correct(view) + 1) % 4 }
      const r: ApiResult = await service.command(by, id, cmd)
      view = r.view
    }
    expect([1, 2]).toContain(view.winner)
  })
})
