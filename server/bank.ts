import { createBank, type Question, type QuestionBank } from '../src/engine/index.js'
import questions from './questions.json' with { type: 'json' }

let bank: QuestionBank | null = null

export function createBankFromFile(): QuestionBank {
  bank ??= createBank(questions as Question[])
  return bank
}
