import { ERROR_MESSAGES, type ApiErrorBody, type ApiErrorCode } from '../src/game/protocol'
import { ApiError, type GameService } from './service'
import { parseApiRequest } from './validate'

/** Descobre o usuário a partir do token da sessão. null = token inválido. */
export type VerifyUser = (token: string) => Promise<string | null>

export interface HttpDeps {
  service: GameService
  verifyUser: VerifyUser
}

const STATUS: Partial<Record<ApiErrorCode, number>> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_A_PLAYER: 403,
  NOT_FOUND: 404,
  NOT_YOUR_TURN: 409,
  WRONG_PHASE: 409,
  MATCH_ENDED: 409,
  MATCH_FULL: 409,
  ALREADY_JOINED: 409,
  CONFLICT: 409,
  INVALID_OPTION: 422,
  INVALID_CROWN: 422,
  DUEL_NOT_AVAILABLE: 422,
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

const error = (code: ApiErrorCode, status = STATUS[code] ?? 500) =>
  json({ error: { code, message: ERROR_MESSAGES[code] } } satisfies ApiErrorBody, status)

/** POST /api/game — único endpoint do jogo. Formato Web (Request → Response). */
export async function handleGameRequest(request: Request, deps: HttpDeps): Promise<Response> {
  if (request.method !== 'POST') return error('BAD_REQUEST', 405)

  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  const userId = token ? await deps.verifyUser(token).catch(() => null) : null
  if (!userId) return error('UNAUTHORIZED')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return error('BAD_REQUEST')
  }

  try {
    const req = parseApiRequest(body)
    const { service } = deps
    switch (req.op) {
      case 'create':
        return json(await service.create(userId, req.name))
      case 'peek':
        return json(await service.peek(userId, req.code))
      case 'join':
        return json(await service.join(userId, req.code, req.name))
      case 'get':
        return json(await service.get(userId, req.matchId))
      case 'command':
        return json(await service.command(userId, req.matchId, req.command))
    }
  } catch (e) {
    if (e instanceof ApiError) return error(e.code)
    console.error('[api/game]', e)
    return error('INTERNAL')
  }
}
