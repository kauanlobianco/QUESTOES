// Garante que o banco de perguntas (com gabarito) não foi parar no build do cliente.
import { readFileSync, readdirSync } from 'node:fs'

const questions = JSON.parse(readFileSync(new URL('../server/questions.json', import.meta.url), 'utf8'))
const dir = new URL('../dist/assets/', import.meta.url)
const files = readdirSync(dir).filter((f) => f.endsWith('.js'))
const bundle = files.map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n')

// Explicações só existem no banco; nenhuma pode aparecer no bundle.
const leaked = questions.filter((q) => bundle.includes(q.explanation.slice(0, 60)))
if (leaked.length) {
  console.error(`✗ ${leaked.length} perguntas do banco estão no bundle (ex.: ${leaked[0].id})`)
  process.exit(1)
}
console.log(`✓ bundle limpo: ${files.length} arquivo(s) JS, 0 de ${questions.length} perguntas`)
