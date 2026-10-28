import type { AREAS } from './rules.js'

export type Area = (typeof AREAS)[number]
export type Slice = Area | 'coringa'
/** Onde a questão pode ser usada (definido no banco de questões). */
export type Mechanic = 'duelo' | 'giro' | 'coroa'
export type PlayerNo = 1 | 2

// ---------- Banco de perguntas (só no servidor) ----------

export interface Question {
  id: string
  area: Area
  /** 1 (fácil) a 5. */
  difficulty: number
  /** Outras áreas que a questão também cobra (questões interdisciplinares). */
  secondaryAreas: Area[]
  mechanics: Mechanic[]
  /** Tempo de resposta definido pelo banco (Duelo 20s, Giro 30s, Coroa 45s). */
  timeLimitMs: number
  /** Micro-cenário lido antes do enunciado. */
  scenario: { title: string; text: string } | null
  text: string
  options: string[]
  correctIndex: number
  /** Uma frase que ensina o conceito. */
  feedback: string
  /** Texto longo para o "saiba mais". */
  explanation: string
  /** Por que cada alternativa errada está errada (null na correta). */
  optionFeedback: (string | null)[]
}

export interface QuestionBank {
  all: readonly Question[]
  byId: ReadonlyMap<string, Question>
}

// ---------- Estado completo da partida (privado) ----------

export type MatchStatus = 'WAITING_OPPONENT' | 'ACTIVE' | 'ENDED'

export type Phase =
  /** Vez de girar a roleta. */
  | 'SPIN'
  /** Pergunta normal ou de coroa servida; aguardando resposta. */
  | 'QUESTION'
  /** Medidor cheio ou fatia Coringa: escolher coroa ou duelo. */
  | 'CROWN_CHOICE'
  /** Respondendo perguntas de duelo (normal ou final). */
  | 'DUEL'
  | 'ENDED'

export type EndedReason = 'CROWNS' | 'ROUNDS' | 'FINAL_DUEL' | 'RESIGNED' | 'EXPIRED'

export interface PlayerStats {
  answered: number
  correct: number
  /** XP somado nos acertos (ausente em partidas criadas antes do XP). */
  xp?: number
  byArea: Record<Area, { answered: number; correct: number }>
}

export interface PlayerState {
  id: string
  name: string
  charges: number
  crowns: Area[]
  stats: PlayerStats
}

export type QuestionKind = 'NORMAL' | 'CROWN' | 'DUEL'

export interface ServedQuestion {
  kind: QuestionKind
  questionId: string
  area: Area
  servedAt: number
  timeLimitMs: number
}

export interface DuelAnswer {
  questionId: string
  correct: boolean
  ms: number
}

export interface DuelState {
  kind: 'NORMAL' | 'FINAL'
  challenger: PlayerNo
  challenged: PlayerNo
  /** Coroa do desafiado que o desafiante quer (só NORMAL). */
  requested: Area | null
  /** Coroa do desafiante em jogo (só NORMAL). */
  offered: Area | null
  questionIds: string[]
  answers: Record<PlayerNo, DuelAnswer[]>
  /** Jogador respondendo agora. */
  stage: PlayerNo
}

export interface DuelResult {
  kind: 'NORMAL' | 'FINAL'
  challenger: PlayerNo
  challenged: PlayerNo
  requested: Area | null
  offered: Area | null
  winner: PlayerNo
  score: Record<PlayerNo, number>
  totalMs: Record<PlayerNo, number>
  tieBreak: 'NONE' | 'TIME' | 'DEFENDER'
}

export type CrownCause = 'CHARGES' | 'CORINGA'

/** Revanche pedida numa partida encerrada: a nova partida e quem pediu. */
export interface RematchLink {
  matchId: string
  by: PlayerNo
}

export interface MatchState {
  id: string
  code: string
  /** Incrementa a cada mudança; o cliente descarta atualizações antigas. */
  seq: number
  status: MatchStatus
  phase: Phase
  endedReason: EndedReason | null
  winner: PlayerNo | null
  round: number
  turnOf: PlayerNo
  players: { 1: PlayerState; 2: PlayerState | null }
  /** Por que a escolha de coroa foi liberada (fase CROWN_CHOICE). */
  crownCause: CrownCause | null
  /** Coroas ganhas no turno corrente (limite do 1º turno). */
  turnCrowns: number
  current: ServedQuestion | null
  lastSpin: Slice | null
  duel: DuelState | null
  lastDuel: DuelResult | null
  usedQuestionIds: string[]
  log: GameEvent[]
  /** Ausente em partidas criadas antes da revanche direta. */
  rematch?: RematchLink | null
  createdAt: number
  updatedAt: number
  expiresAt: number
}

// ---------- Comandos ----------

export type Command =
  | { type: 'JOIN'; by: string; name: string }
  | { type: 'SPIN'; by: string }
  /** option null = o cliente viu o tempo acabar. */
  | { type: 'ANSWER'; by: string; option: number | null }
  | { type: 'CHOOSE_CROWN'; by: string; area: Area }
  | { type: 'START_DUEL'; by: string; requested: Area; offered: Area }
  | { type: 'DUEL_NEXT'; by: string }
  | { type: 'RESIGN'; by: string }

export interface Ctx {
  now: number
  /** Retorna número em [0, 1). */
  rng: () => number
  bank: QuestionBank
}

// ---------- Eventos (log e animações) ----------

export type TurnEndReason = 'WRONG' | 'TIMEOUT' | 'CROWN_LIMIT' | 'DUEL_SENT'

export type GameEvent =
  | { type: 'PLAYER_JOINED'; player: PlayerNo; at: number }
  | { type: 'SPUN'; player: PlayerNo; slice: Slice; at: number }
  | { type: 'ANSWERED'; player: PlayerNo; kind: QuestionKind; area: Area; correct: boolean; timeout: boolean; at: number }
  | { type: 'CHARGE_FULL'; player: PlayerNo; at: number }
  | { type: 'CROWN_WON'; player: PlayerNo; area: Area; at: number }
  | { type: 'TURN_ENDED'; player: PlayerNo; reason: TurnEndReason; at: number }
  | { type: 'DUEL_STARTED'; challenger: PlayerNo; requested: Area; offered: Area; at: number }
  | { type: 'DUEL_ENDED'; result: DuelResult; at: number }
  | { type: 'FINAL_DUEL_STARTED'; at: number }
  | { type: 'GAME_ENDED'; winner: PlayerNo | null; reason: EndedReason; at: number }

/** O que o jogador descobre logo após responder. */
export interface AnswerReveal {
  questionId: string
  correct: boolean
  timeout: boolean
  correctIndex: number
  /** XP ganho nesta resposta (0 se errou). */
  xp: number
  feedback: string
  /** Por que a alternativa escolhida está errada; null se acertou ou não respondeu. */
  optionFeedback: string | null
  explanation: string
}

export interface ReduceResult {
  state: MatchState
  events: GameEvent[]
  reveal?: AnswerReveal
  spin?: Slice
}
