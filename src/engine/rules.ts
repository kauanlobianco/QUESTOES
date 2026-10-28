// Todos os números de balanceamento do jogo. Ajuste aqui após playtest.

export const AREAS = [
  'empreendedorismo',
  'marketing',
  'financas',
  'operacoes',
  'lideranca',
  'estrategia',
] as const

export const RULES = {
  /** Acertos normais que enchem o medidor e liberam a escolha de coroa. */
  chargesForCrown: 3,
  /** Coroas (personagens) para vencer. */
  crownsToWin: AREAS.length,
  /** Coroas máximas no primeiro turno de cada jogador (rodada 1). */
  firstTurnCrownLimit: 1,
  /** Rodadas antes de encerrar por contagem de coroas. */
  maxRounds: 25,
  /** Duração da animação da roleta; o tempo da pergunta começa depois dela. */
  spinRevealMs: 3_500,
  /** Folga de rede antes de considerar a resposta fora do tempo. */
  graceMs: 2_000,
  /** Inatividade que encerra a partida; quem devia jogar perde. */
  expireAfterMs: 72 * 60 * 60 * 1000,
  /** Mecânica do banco usada em cada tipo de pergunta. O tempo vem de cada questão. */
  mechanicFor: { NORMAL: 'giro', CROWN: 'coroa', DUEL: 'duelo' },
  /** XP por acerto em cada tipo de pergunta (mesma escala do banco: Giro 10, Duelo 15, Coroa 30). */
  xpFor: { NORMAL: 10, CROWN: 30, DUEL: 15 },
  /** Entradas de log mantidas no estado. */
  logSize: 40,
} as const
