import { GameError } from './errors'
import { pickOne, shuffle } from './rng'
import { AREAS, RULES } from './rules'
import type { Area, Mechanic, Question, QuestionBank } from './types'

export function createBank(questions: readonly Question[]): QuestionBank {
  return { all: questions, byId: new Map(questions.map((q) => [q.id, q])) }
}

export function getQuestion(bank: QuestionBank, id: string): Question {
  const q = bank.byId.get(id)
  if (!q) throw new GameError('NO_QUESTIONS', `pergunta inexistente: ${id}`)
  return q
}

/**
 * Sorteia pergunta da área para a mecânica, sem repetir na partida. Se acabar,
 * aceita repetidas da mecânica e, por fim, qualquer pergunta da área.
 */
export function pickQuestion(
  bank: QuestionBank,
  used: ReadonlySet<string>,
  area: Area,
  mechanic: Mechanic | null,
  rng: () => number,
): Question {
  const ofArea = bank.all.filter((q) => q.area === area)
  const fits = mechanic ? ofArea.filter((q) => q.mechanics.includes(mechanic)) : ofArea
  const pools = [fits.filter((q) => !used.has(q.id)), fits, ofArea]
  const pool = pools.find((p) => p.length > 0)
  if (!pool) throw new GameError('NO_QUESTIONS', `sem perguntas para ${area}`)
  return pickOne(pool, rng)
}

/** Seis perguntas de duelo, uma por área, em ordem sorteada. */
export function pickDuelQuestions(bank: QuestionBank, used: ReadonlySet<string>, rng: () => number): string[] {
  const taken = new Set(used)
  return shuffle(AREAS, rng).map((area) => {
    const q = pickQuestion(bank, taken, area, RULES.mechanicFor.DUEL, rng)
    taken.add(q.id)
    return q.id
  })
}
