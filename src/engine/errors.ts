export type GameErrorCode =
  | 'NOT_A_PLAYER'
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE'
  | 'MATCH_ENDED'
  | 'MATCH_FULL'
  | 'ALREADY_JOINED'
  | 'INVALID_OPTION'
  | 'INVALID_CROWN'
  | 'DUEL_NOT_AVAILABLE'
  | 'NO_QUESTIONS'

export class GameError extends Error {
  readonly code: GameErrorCode

  constructor(code: GameErrorCode, message: string = code) {
    super(message)
    this.name = 'GameError'
    this.code = code
  }
}
