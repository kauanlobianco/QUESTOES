// Teste ponta a ponta do modo online contra um Supabase real (local ou nuvem)
// e o servidor de desenvolvimento (`npm run dev`).
//
// Uso: node scripts/e2e-online.mjs [http://localhost:5173]
// Lê VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY de .env.local (ou do arquivo em E2E_ENV_FILE).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const env = Object.fromEntries(
  readFileSync(new URL(`../${process.env.E2E_ENV_FILE ?? '.env.local'}`, import.meta.url), 'utf8')
    .split('\n')
    .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
)
// Gabarito só para o robô responder certo; o cliente real nunca o vê.
const bank = new Map(JSON.parse(readFileSync(new URL('../server/questions.json', import.meta.url), 'utf8')).map((q) => [q.id, q]))

const assert = (cond, msg) => {
  if (!cond) throw new Error(`✗ ${msg}`)
  console.log(`✓ ${msg}`)
}

async function player(label) {
  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.signInAnonymously()
  if (error) throw error
  const token = data.session.access_token
  const api = async (body) => {
    const res = await fetch(`${BASE}/api/game`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    return { status: res.status, ...json }
  }
  return { label, sb, id: data.user.id, api }
}

const ana = await player('Ana')
const bia = await player('Bia')
const eve = await player('Eve')
assert(ana.id !== bia.id, 'login anônimo gera usuários distintos')

const created = await ana.api({ op: 'create', name: 'Ana' })
assert(created.status === 200 && created.view.status === 'WAITING_OPPONENT', `partida criada (código ${created.view?.code})`)
const { id, code } = created.view

const peek = await bia.api({ op: 'peek', code })
assert(peek.hostName === 'Ana' && !peek.full && !peek.isPlayer, 'Bia vê o convite da Ana')

// Bia assina a partida antes de entrar? Não: RLS só libera depois de entrar.
const joined = await bia.api({ op: 'join', code, name: 'Bia' })
assert(joined.status === 200 && joined.view.status === 'ACTIVE', 'Bia entra pelo código')

const eveJoin = await eve.api({ op: 'join', code, name: 'Eve' })
assert(eveJoin.status === 409 && eveJoin.error.code === 'MATCH_FULL', 'terceiro jogador é barrado')

// RLS direto na tabela
const { data: biaRows } = await bia.sb.from('matches').select('id').eq('id', id)
const { data: eveRows } = await eve.sb.from('matches').select('id').eq('id', id)
const { error: stateErr } = await ana.sb.from('match_state').select('*')
const { error: updErr, count } = await ana.sb.from('matches').update({ status: 'ENDED' }, { count: 'exact' }).eq('id', id)
assert(biaRows?.length === 1, 'RLS: jogadora lê a partida')
assert(eveRows?.length === 0, 'RLS: estranho não vê a partida')
assert(!!stateErr, `RLS: match_state bloqueado (${stateErr?.code})`)
assert(!!updErr || count === 0, 'RLS: cliente não altera a partida')

// Realtime: Bia recebe as jogadas da Ana
const received = []
const channel = bia.sb
  .channel(`match:${id}`)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, (p) => received.push(p.new.view))
await new Promise((resolve, reject) => {
  channel.subscribe((status, err) => (status === 'SUBSCRIBED' ? resolve() : status.includes('ERROR') || status === 'TIMED_OUT' ? reject(err ?? new Error(status)) : null))
})
await bia.sb.realtime.setAuth()

const users = { 1: ana, 2: bia }
let view = joined.view
let steps = 0
let duels = 0
let lastSeq = view.seq
while (view.status !== 'ENDED') {
  if (++steps > 600) throw new Error('partida não terminou')
  const p = users[view.turnOf]
  let command
  if (view.phase === 'SPIN') command = { type: 'SPIN' }
  else if (view.phase === 'CROWN_CHOICE') {
    const me = view.players[view.turnOf]
    const opp = view.players[view.turnOf === 1 ? 2 : 1]
    const requestable = opp.crowns.filter((a) => !me.crowns.includes(a))
    if (requestable.length && me.crowns.length && duels < 2) {
      duels++
      command = { type: 'START_DUEL', requested: requestable[0], offered: me.crowns[0] }
    } else {
      const area = ['empreendedorismo', 'marketing', 'financas', 'operacoes', 'lideranca', 'estrategia'].find((a) => !me.crowns.includes(a))
      command = { type: 'CHOOSE_CROWN', area }
    }
  } else if (view.phase === 'DUEL' && !view.current) command = { type: 'DUEL_NEXT' }
  else {
    const correct = bank.get(view.current.id).correctIndex
    // Ana acerta ~85%; Bia ~75%.
    const right = Math.random() < (view.turnOf === 1 ? 0.85 : 0.75)
    command = { type: 'ANSWER', option: right ? correct : (correct + 1) % 4 }
  }
  const r = await p.api({ op: 'command', matchId: id, command })
  if (r.status !== 200) throw new Error(`${p.label} ${JSON.stringify(command)} → ${r.status} ${JSON.stringify(r.error)}`)
  // `reveal` traz o gabarito de propósito, só depois da resposta. A view nunca.
  if (JSON.stringify(r.view).includes('correctIndex')) throw new Error('gabarito vazou na view')
  if (r.view.seq <= lastSeq) throw new Error(`seq não avançou (${lastSeq} → ${r.view.seq})`)
  lastSeq = r.view.seq
  view = r.view
}
assert(true, `partida terminou em ${steps} comandos: ${view.players[view.winner].name} venceu (${view.endedReason}), duelos: ${duels}`)

await new Promise((r) => setTimeout(r, 1500))
assert(received.length > 0, `Realtime: Bia recebeu ${received.length} atualizações`)
assert(received.some((v) => v.status === 'ENDED'), 'Realtime: Bia viu o fim da partida')
assert(!JSON.stringify(received).includes('correctIndex'), 'Realtime: nenhuma atualização contém gabarito')

// Revanche direta: quem pede começa; o outro cai na mesma partida.
const rem = await bia.api({ op: 'rematch', matchId: id })
assert(
  rem.status === 200 && rem.view.status === 'ACTIVE' && rem.view.players[1].id === bia.id && rem.view.players[2].id === ana.id,
  'revanche: Bia pede, começa jogando e Ana já está na partida',
)
const remAna = await ana.api({ op: 'rematch', matchId: id })
assert(remAna.status === 200 && remAna.view.id === rem.view.id, 'revanche: pedido da Ana cai na mesma partida')
const eveRem = await eve.api({ op: 'rematch', matchId: id })
assert(eveRem.status === 403, 'revanche: estranho é barrado')
const { data: anaRem } = await ana.sb.from('matches').select('id').eq('id', rem.view.id)
assert(anaRem?.length === 1, 'RLS: Ana lê a partida da revanche')
await new Promise((r) => setTimeout(r, 1000))
assert(received.some((v) => v.rematch?.matchId === rem.view.id), 'Realtime: a partida antiga avisa a revanche')

const list = await ana.sb.from('matches').select('view').order('updated_at', { ascending: false })
assert(list.data?.some((r) => r.view.id === id), 'lista de partidas da Ana inclui a partida')

await bia.sb.removeChannel(channel)
console.log('\nTudo certo.')
process.exit(0)
