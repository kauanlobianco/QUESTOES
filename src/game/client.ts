import type { MatchView } from '../engine'
import { ERROR_MESSAGES, type ApiErrorCode, type ClientCommand, type CommandResult, type InvitePeek } from './protocol'

export type { ClientCommand, CommandResult } from './protocol'

/**
 * Transporte da partida. `local` roda a engine no navegador (hot-seat, só em
 * desenvolvimento); `remote` fala com /api/game e assina o Supabase Realtime.
 */
export interface GameClient {
  readonly mode: 'local' | 'remote'
  /** Usuário da sessão (remoto) ou null (hot-seat: os dois jogadores são locais). */
  readonly userId: string | null
  createMatch(input: { p1Name: string; p2Name?: string }): Promise<MatchView>
  listMatches(): Promise<MatchView[]>
  getMatch(id: string): Promise<MatchView>
  send(id: string, cmd: ClientCommand): Promise<CommandResult>
  /** `onStatus(false)` quando a conexão em tempo real cai; `true` quando volta. */
  subscribe(id: string, onView: (view: MatchView) => void, onStatus?: (live: boolean) => void): () => void
  peekInvite?(code: string): Promise<InvitePeek>
  joinMatch?(code: string, name: string): Promise<MatchView>
  /** Revanche com o mesmo rival (online): cria ou devolve a partida ligada. */
  rematch?(id: string): Promise<MatchView>
  /** Avisa quando qualquer partida do usuário muda (lista da Home). */
  watchMatches?(onChange: () => void): () => void
}

export class ClientError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, message = ERROR_MESSAGES[code]) {
    super(message)
    this.name = 'ClientError'
    this.code = code
  }
}
