// Regras de acesso da API: quem pode criar, entrar, ler e jogar cada partida.
// A lógica do jogo em si fica toda na engine.
import {
  GameError,
  createMatch,
  linkRematch,
  other,
  playerNoOf,
  reduce,
  settle,
  toPublicView,
  type Command,
  type Ctx,
  type MatchState,
  type QuestionBank,
  type ReduceResult,
} from '../src/engine/index.js'
import { newInviteCode } from '../src/game/ids.js'
import type { ApiErrorCode, ApiResult, ClientCommand, InvitePeek } from '../src/game/protocol.js'
import type { MatchRepo, StoredMatch } from './repo.js'

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, message: string = code) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export interface GameServiceDeps {
  repo: MatchRepo
  bank: QuestionBank
  now?: () => number
  rng?: () => number
  newId?: () => string
  newCode?: () => string
}

/** Tentativas quando outra escrita muda a partida entre a leitura e a gravação. */
const MAX_ATTEMPTS = 3
const MAX_CODE_ATTEMPTS = 5

export type GameService = ReturnType<typeof createGameService>

export function createGameService(deps: GameServiceDeps) {
  const { repo, bank } = deps
  const now = deps.now ?? Date.now
  const rng = deps.rng ?? cryptoRandom
  const newId = deps.newId ?? (() => crypto.randomUUID())
  const newCode = deps.newCode ?? (() => newInviteCode())
  const ctx = (): Ctx => ({ now: now(), rng, bank })

  const result = (state: MatchState, r?: Partial<ReduceResult>): ApiResult => ({
    view: toPublicView(state, bank),
    events: r?.events ?? [],
    reveal: r?.reveal,
    spin: r?.spin,
    now: now(),
  })

  async function load(key: { id: string } | { code: string }): Promise<StoredMatch> {
    const row = await repo.load(key)
    if (!row) throw new ApiError('NOT_FOUND')
    return row
  }

  /**
   * Lê, aplica o relógio (timeouts/expiração), roda `fn` e grava com controle de
   * versão. Se `fn` falhar, ainda grava o que o relógio mudou.
   */
  async function mutate(
    key: { id: string } | { code: string },
    fn: (row: StoredMatch, state: MatchState) => ReduceResult | null,
  ): Promise<ApiResult> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const row = await load(key)
      const settled = settle(row.state, ctx())
      const changedByClock = settled.events.length > 0
      let out: ReduceResult | null
      try {
        out = fn(row, settled.state)
      } catch (e) {
        if (changedByClock) await repo.commit(row.id, row.version, settled.state, toPublicView(settled.state, bank))
        if (e instanceof GameError) throw new ApiError(e.code, e.message)
        throw e
      }
      const final = out ?? settled
      if (out === null && !changedByClock) return result(row.state)
      const ok = await repo.commit(row.id, row.version, final.state, toPublicView(final.state, bank))
      if (ok) {
        return result(final.state, { ...final, events: [...settled.events, ...(out?.events ?? [])] })
      }
    }
    throw new ApiError('CONFLICT')
  }

  function requirePlayer(state: MatchState, userId: string) {
    if (!playerNoOf(state, userId)) throw new ApiError('NOT_A_PLAYER')
  }

  /** Grava uma partida nova com um código livre. false se o id já existe. */
  async function insert(id: string, creatorId: string, creatorName: string): Promise<MatchState | null> {
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
      const state = createMatch({ id, code: newCode(), creatorId, creatorName, now: now() })
      if (await repo.create(state, toPublicView(state, bank))) return state
      if (await repo.load({ id })) return null
    }
    throw new ApiError('CONFLICT', 'não foi possível gerar código de convite')
  }

  return {
    async create(userId: string, name: string): Promise<ApiResult> {
      const state = await insert(newId(), userId, name)
      if (!state) throw new ApiError('CONFLICT')
      return result(state)
    },

    /**
     * Revanche com o mesmo rival. O primeiro pedido liga a partida encerrada a
     * uma nova (quem pede começa); pedidos seguintes, dos dois jogadores,
     * caem na mesma partida.
     */
    async rematch(userId: string, matchId: string): Promise<ApiResult> {
      const linked = await mutate({ id: matchId }, (_row, state) => {
        requirePlayer(state, userId)
        if (state.rematch) return null
        return linkRematch(state, newId(), playerNoOf(state, userId)!)
      })
      const link = linked.view.rematch!
      const host = linked.view.players[link.by]!
      const guest = linked.view.players[other(link.by)]!
      await insert(link.matchId, host.id, host.name)
      return mutate({ id: link.matchId }, (_row, state) => {
        if (playerNoOf(state, guest.id)) return null
        return reduce(state, { type: 'JOIN', by: guest.id, name: guest.name }, ctx())
      })
    },

    async peek(userId: string, code: string): Promise<InvitePeek> {
      const row = await load({ code })
      const { state } = settle(row.state, ctx())
      return {
        matchId: state.id,
        code: state.code,
        hostName: state.players[1].name,
        status: state.status,
        full: state.players[2] !== null,
        isPlayer: playerNoOf(state, userId) !== null,
        now: now(),
      }
    },

    /** Entrar pelo código. Idempotente para quem já está na partida. */
    join(userId: string, code: string, name: string): Promise<ApiResult> {
      return mutate({ code }, (_row, state) => {
        if (playerNoOf(state, userId)) return null
        return reduce(state, { type: 'JOIN', by: userId, name }, ctx())
      })
    },

    get(userId: string, matchId: string): Promise<ApiResult> {
      return mutate({ id: matchId }, (_row, state) => {
        requirePlayer(state, userId)
        return null
      })
    },

    command(userId: string, matchId: string, command: ClientCommand): Promise<ApiResult> {
      return mutate({ id: matchId }, (_row, state) => {
        requirePlayer(state, userId)
        return reduce(state, { ...command, by: userId } as Command, ctx())
      })
    },
  }
}

function cryptoRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296
}
