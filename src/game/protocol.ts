// Contrato entre o navegador e /api/game. Só tipos: usado pelos dois lados.
import type { AnswerReveal, Area, GameErrorCode, GameEvent, MatchView, Slice } from '../engine/index.js'

/** Comando de jogo como o cliente envia: quem joga é decidido pela sessão. */
export type ClientCommand =
  | { type: 'SPIN' }
  | { type: 'ANSWER'; option: number | null }
  | { type: 'CHOOSE_CROWN'; area: Area }
  | { type: 'START_DUEL'; requested: Area; offered: Area }
  | { type: 'DUEL_NEXT' }
  | { type: 'RESIGN' }

export type ApiRequest =
  | { op: 'create'; name: string }
  | { op: 'peek'; code: string }
  | { op: 'join'; code: string; name: string }
  | { op: 'get'; matchId: string }
  | { op: 'command'; matchId: string; command: ClientCommand }
  /** Revanche com o mesmo rival: cria (ou devolve) a partida ligada a uma encerrada. */
  | { op: 'rematch'; matchId: string }

export interface CommandResult {
  view: MatchView
  events: GameEvent[]
  reveal?: AnswerReveal
  spin?: Slice
}

/** Resposta de create/join/get/command. `now` permite corrigir o relógio do cliente. */
export interface ApiResult extends CommandResult {
  now: number
}

/** Prévia do convite para quem ainda não entrou na partida. */
export interface InvitePeek {
  matchId: string
  code: string
  hostName: string
  status: MatchView['status']
  full: boolean
  /** O usuário que pergunta já é jogador desta partida. */
  isPlayer: boolean
  now: number
}

export type ApiErrorCode = GameErrorCode | 'NOT_FOUND' | 'BAD_REQUEST' | 'UNAUTHORIZED' | 'CONFLICT' | 'INTERNAL' | 'NETWORK'

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string }
}

export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  NOT_A_PLAYER: 'Você não faz parte desta partida.',
  NOT_YOUR_TURN: 'Ainda não é a sua vez.',
  WRONG_PHASE: 'Essa ação não vale agora.',
  MATCH_ENDED: 'A partida já terminou.',
  MATCH_FULL: 'Essa partida já tem dois jogadores.',
  ALREADY_JOINED: 'Você já está nesta partida.',
  INVALID_OPTION: 'Alternativa inválida.',
  INVALID_CROWN: 'Esse personagem não está disponível.',
  DUEL_NOT_AVAILABLE: 'Duelo indisponível agora.',
  NO_QUESTIONS: 'Sem perguntas disponíveis.',
  NOT_FOUND: 'Partida não encontrada.',
  BAD_REQUEST: 'Pedido inválido.',
  UNAUTHORIZED: 'Sessão expirada. Recarregue a página.',
  CONFLICT: 'A partida mudou enquanto você jogava. Tente de novo.',
  INTERNAL: 'Erro no servidor. Tente de novo.',
  NETWORK: 'Sem conexão. Tente de novo.',
}

export const MAX_NAME_LENGTH = 16
