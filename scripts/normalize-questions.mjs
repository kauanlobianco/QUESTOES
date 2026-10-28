// Converte o banco final de questões (banco-questoes/banco-final/banco-questoes.json)
// para o formato enxuto do servidor (server/questions.json).
// Falha se algum item não servir para o jogo.
import { readFileSync, writeFileSync } from 'node:fs'

/** Banco que entra no jogo. Gerado em banco-questoes/ por `python scripts/montar_banco_final.py`. */
const LOTES = ['banco-questoes.json']

const TARGET = new URL('../server/questions.json', import.meta.url)

const AREAS = {
  EMP: 'empreendedorismo',
  MKT: 'marketing',
  FIN: 'financas',
  OPE: 'operacoes',
  LID: 'lideranca',
  EST: 'estrategia',
}
const MECHANICS = new Set(['duelo', 'giro', 'coroa'])

const errors = []
const seenIds = new Set()
const seenTexts = new Map()
const questions = []

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '')

for (const file of LOTES) {
  const { questoes } = JSON.parse(readFileSync(new URL(`../banco-questoes/banco-final/${file}`, import.meta.url), 'utf8'))
  for (const q of questoes) {
    const id = q.id
    const fail = (msg) => errors.push(`${file} ${id}: ${msg}`)

    // Desempate numérico ainda não existe no jogo.
    if (q.tipo !== 'multipla_escolha') continue

    const area = AREAS[q.area]
    if (!area) fail(`área desconhecida "${q.area}"`)
    if (seenIds.has(id)) fail('id repetido')
    seenIds.add(id)

    const alts = q.alternativas ?? []
    if (alts.length !== 4) fail(`${alts.length} alternativas (precisa de 4)`)
    const correct = alts.filter((a) => a.correta)
    if (correct.length !== 1) fail(`${correct.length} alternativas corretas`)
    const options = alts.map((a) => clean(a.texto))
    if (options.some((o) => !o)) fail('alternativa vazia')
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) fail('alternativas repetidas')

    const mechanics = (q.mecanicas ?? []).filter((m) => MECHANICS.has(m))
    if (mechanics.length === 0) fail('sem mecânica de jogo (duelo/giro/coroa)')
    if (!Number.isInteger(q.tempo_seg) || q.tempo_seg < 10) fail(`tempo_seg inválido "${q.tempo_seg}"`)
    if (!Number.isInteger(q.dificuldade)) fail('dificuldade ausente')

    const text = clean(q.enunciado)
    if (!text) fail('enunciado vazio')
    const feedback = clean(q.feedback?.curto)
    if (!feedback) fail('feedback.curto vazio')

    const scenario = q.cenario ? { title: clean(q.cenario.titulo), text: clean(q.cenario.texto) } : null
    if (scenario && !scenario.text) fail('cenário sem texto')

    const secondaryAreas = (q.areas_secundarias ?? []).map((a) => AREAS[a])
    if (secondaryAreas.some((a) => !a)) fail(`área secundária desconhecida em ${JSON.stringify(q.areas_secundarias)}`)

    const key = `${scenario?.text ?? ''}|${text}`.toLowerCase()
    if (seenTexts.has(key)) fail(`enunciado repetido de ${seenTexts.get(key)}`)
    seenTexts.set(key, id)

    questions.push({
      id,
      area,
      difficulty: q.dificuldade,
      secondaryAreas,
      mechanics,
      timeLimitMs: q.tempo_seg * 1000,
      scenario,
      text,
      options,
      correctIndex: alts.findIndex((a) => a.correta),
      feedback,
      explanation: clean(q.feedback?.explicacao),
      optionFeedback: alts.map((a) => (a.correta ? null : clean(a.feedback) || null)),
    })
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problema(s):\n` + errors.map((e) => `  - ${e}`).join('\n'))
  process.exit(1)
}

writeFileSync(TARGET, JSON.stringify(questions, null, 1) + '\n')

const summary = {}
for (const q of questions) {
  summary[q.area] ??= { total: 0, duelo: 0, giro: 0, coroa: 0, cenario: 0 }
  const s = summary[q.area]
  s.total++
  for (const m of q.mechanics) s[m]++
  if (q.scenario) s.cenario++
}
console.log(`✓ ${questions.length} perguntas → server/questions.json`)
console.table(summary)
