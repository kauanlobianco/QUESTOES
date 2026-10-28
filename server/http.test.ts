import { describe, expect, it } from 'vitest'
import { createBankFromFile } from './bank'
import { handleGameRequest, type HttpDeps } from './http'
import { memoryRepo } from './repo'
import { createGameService } from './service'

const ANA = '11111111-1111-4111-8111-111111111111'
const BIA = '22222222-2222-4222-8222-222222222222'
const TOKENS: Record<string, string> = { 'token-ana': ANA, 'token-bia': BIA }

function deps(): HttpDeps {
  return {
    service: createGameService({ repo: memoryRepo(), bank: createBankFromFile() }),
    verifyUser: async (t) => TOKENS[t] ?? null,
  }
}

function call(d: HttpDeps, body: unknown, token: string | null = 'token-ana', method = 'POST') {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return handleGameRequest(
    new Request('http://x/api/game', { method, headers, body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined }),
    d,
  )
}

describe('POST /api/game', () => {
  it('exige sessão válida', async () => {
    const d = deps()
    expect((await call(d, { op: 'create', name: 'Ana' }, null)).status).toBe(401)
    expect((await call(d, { op: 'create', name: 'Ana' }, 'falso')).status).toBe(401)
  })

  it('rejeita método, JSON e pedidos inválidos', async () => {
    const d = deps()
    expect((await call(d, null, 'token-ana', 'GET')).status).toBe(405)
    expect((await call(d, '{quebrado')).status).toBe(400)
    expect((await call(d, { op: 'hack' })).status).toBe(400)
    expect((await call(d, { op: 'create', name: '' })).status).toBe(400)
    expect((await call(d, { op: 'create', name: 'x'.repeat(17) })).status).toBe(400)
    expect((await call(d, { op: 'get', matchId: 'nao-e-uuid' })).status).toBe(400)
    expect((await call(d, { op: 'command', matchId: ANA, command: { type: 'CHOOSE_CROWN', area: 'química' } })).status).toBe(400)
    expect((await call(d, { op: 'command', matchId: ANA, command: { type: 'ANSWER', option: 1.5 } })).status).toBe(400)
  })

  it('limpa o nome (caracteres de controle e espaços)', async () => {
    const res = await call(deps(), { op: 'create', name: '  Ana\u0000  Lu\n ' })
    expect(res.status).toBe(200)
    expect((await res.json()).view.players[1].name).toBe('Ana Lu')
  })

  it('fluxo criar → entrar → jogar, com erros de regra em 409', async () => {
    const d = deps()
    const created = await (await call(d, { op: 'create', name: 'Ana' })).json()
    const { id, code } = created.view

    const joined = await call(d, { op: 'join', code: code.toLowerCase(), name: 'Bia' }, 'token-bia')
    expect(joined.status).toBe(200)

    const wrongTurn = await call(d, { op: 'command', matchId: id, command: { type: 'SPIN' } }, 'token-bia')
    expect(wrongTurn.status).toBe(409)
    expect(await wrongTurn.json()).toEqual({ error: { code: 'NOT_YOUR_TURN', message: 'Ainda não é a sua vez.' } })

    const spun = await call(d, { op: 'command', matchId: id, command: { type: 'SPIN' } })
    expect(spun.status).toBe(200)
    expect(spun.headers.get('cache-control')).toBe('no-store')
    const body = await spun.json()
    expect(body.spin).toBeDefined()
    expect(JSON.stringify(body)).not.toContain('correctIndex')
  })

  it('partida inexistente → 404', async () => {
    const res = await call(deps(), { op: 'get', matchId: '99999999-9999-4999-8999-999999999999' })
    expect(res.status).toBe(404)
  })
})
