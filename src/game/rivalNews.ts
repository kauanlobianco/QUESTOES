// O que o rival fez desde a última vez que o jogador olhou a partida (online).
// O cursor é o `at` do evento mais novo já visto, guardado por partida no navegador.
import { other, type Area, type GameEvent, type MatchView, type PlayerNo } from '../engine'

const KEY = (matchId: string) => `mdn:seen:${matchId}`

export function loadSeen(matchId: string): number | null {
  try {
    const raw = localStorage.getItem(KEY(matchId))
    return raw === null ? null : Number(raw)
  } catch {
    return null
  }
}

export function saveSeen(matchId: string, at: number) {
  try {
    localStorage.setItem(KEY(matchId), String(at))
  } catch {
    // Ignora: modo privado.
  }
}

/** Evento mais novo do log (ou o cursor atual, se o log estiver vazio). */
export const latestAt = (log: GameEvent[], fallback: number | null = null) =>
  log.reduce<number | null>((max, e) => (max === null || e.at > max ? e.at : max), fallback)

/** Quem causou o evento; null para eventos da partida (fim de duelo, fim de jogo). */
export function actorOf(e: GameEvent): PlayerNo | null {
  switch (e.type) {
    case 'DUEL_STARTED':
      return e.challenger
    case 'DUEL_ENDED':
    case 'FINAL_DUEL_STARTED':
    case 'GAME_ENDED':
      return null
    default:
      return e.player
  }
}

/**
 * Eventos novos que o jogador não causou. Sem cursor (primeira vez neste
 * navegador), considera só o trecho depois da última jogada dele.
 */
export function freshRivalEvents(log: GameEvent[], me: PlayerNo, seen: number | null): GameEvent[] {
  let start = 0
  if (seen === null) {
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]!
      if (actorOf(e) === me && e.type !== 'PLAYER_JOINED') {
        start = i + 1
        break
      }
    }
  }
  return log.slice(start).filter((e) => (seen === null || e.at > seen) && actorOf(e) !== me)
}

/** Os eventos devolveram a vez ao jogador? */
export function handsTurnTo(view: MatchView, me: PlayerNo, events: GameEvent[]): boolean {
  if (view.status !== 'ACTIVE' || view.turnOf !== me) return false
  return events.some(
    (e) => (e.type === 'TURN_ENDED' && e.player !== me) || e.type === 'DUEL_ENDED' || e.type === 'FINAL_DUEL_STARTED',
  )
}

/** Frases curtas do resumo "Sua vez!". */
export function turnSummary(view: MatchView, me: PlayerNo, events: GameEvent[], areaName: (a: Area) => string): string[] {
  const rival = other(me)
  const name = view.players[rival]?.name ?? 'Seu rival'
  const lines: string[] = []

  const answers = events.filter((e) => e.type === 'ANSWERED' && e.player === rival && e.kind !== 'DUEL')
  const right = answers.filter((e) => e.type === 'ANSWERED' && e.correct).length
  if (answers.length) lines.push(`${name} acertou ${right} de ${answers.length} ${answers.length === 1 ? 'pergunta' : 'perguntas'}.`)

  const crowns = events.flatMap((e) => (e.type === 'CROWN_WON' && e.player === rival ? [areaName(e.area)] : []))
  if (crowns.length) lines.push(`Conquistou ${crowns.join(' e ')}.`)

  const ended = findLast(events, (e) => e.type === 'TURN_ENDED' && e.player === rival)
  const lastWrong = findLast(answers, (e) => e.type === 'ANSWERED' && !e.correct)
  const wrongArea = lastWrong?.type === 'ANSWERED' ? areaName(lastWrong.area) : null
  if (ended?.type === 'TURN_ENDED') {
    if (ended.reason === 'WRONG' && wrongArea) lines.push(`Errou uma de ${wrongArea}.`)
    if (ended.reason === 'TIMEOUT') lines.push(wrongArea ? `O tempo acabou numa de ${wrongArea}.` : 'O tempo acabou.')
    if (ended.reason === 'CROWN_LIMIT') lines.push('Já levou o personagem do primeiro turno.')
    if (ended.reason === 'DUEL_SENT') {
      const duel = findLast(events, (e) => e.type === 'DUEL_STARTED')
      lines.push(
        duel?.type === 'DUEL_STARTED'
          ? `Te desafiou para um duelo: quer ${areaName(duel.requested)} e aposta ${areaName(duel.offered)}.`
          : 'Te desafiou para um duelo!',
      )
    }
  }
  if (events.some((e) => e.type === 'FINAL_DUEL_STARTED')) lines.push('Fim das rodadas empatado: duelo final!')
  return lines
}

function findLast<T>(list: T[], pred: (x: T) => boolean): T | undefined {
  for (let i = list.length - 1; i >= 0; i--) if (pred(list[i]!)) return list[i]
  return undefined
}
