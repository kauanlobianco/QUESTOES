import { createBank, type Question, type QuestionBank } from '../src/engine'
import questions from './questions.json'

let bank: QuestionBank | null = null

export function createBankFromFile(): QuestionBank {
  bank ??= createBank(questions as Question[])
  return bank
}
