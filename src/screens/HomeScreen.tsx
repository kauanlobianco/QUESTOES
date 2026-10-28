import { motion } from 'motion/react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { AREAS, playerNoOf, type MatchView } from '../engine'
import { AREA_INFO } from '../content/areas'
import type { GameClient } from '../game/client'
import { useClients, type ClientKind } from '../game/GameClientContext'
import { loadNickname, saveNickname } from '../game/nickname'
import { matchPath } from '../game/paths'
import { MAX_NAME_LENGTH } from '../game/protocol'
import { Button } from '../ui/Button'
import { PLAYER_ACCENT } from '../ui/theme'

const NAMES_KEY = 'mdn:hotseat-names'

function loadNames(): [string, string] {
  try {
    const saved = JSON.parse(localStorage.getItem(NAMES_KEY) ?? 'null')
    if (Array.isArray(saved) && saved.length === 2) return [String(saved[0]), String(saved[1])]
  } catch {
    // Sem nomes salvos.
  }
  return ['', '']
}

const inputClass =
  'w-full rounded-xl bg-white px-4 py-3 font-semibold text-ink outline-none ring-coringa-gold placeholder:text-ink/40 focus:ring-4'

export function HomeScreen() {
  const { local, remote, remoteError } = useClients()
  const [remoteMatches, setRemoteMatches] = useState<MatchView[]>([])
  const [localMatches, setLocalMatches] = useState<MatchView[]>([])

  useEffect(() => {
    remote?.listMatches().then(setRemoteMatches, () => {})
    local?.listMatches().then(setLocalMatches, () => {})
  }, [remote, local])

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-4 py-8">
      <header className="flex flex-col items-center gap-4 text-center">
        <div className="flex -space-x-5">
          {AREAS.map((a, i) => (
            <motion.img
              key={a}
              src={AREA_INFO[a].hero}
              alt=""
              className="h-20 object-contain drop-shadow-lg"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.07, type: 'spring', stiffness: 260, damping: 18 }}
            />
          ))}
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold text-coringa-gold">Mestre dos Negócios</h1>
          <p className="mt-1 text-white/70">Gire a roleta, acerte e conquiste os 6 personagens.</p>
        </div>
      </header>

      {remote ? <OnlineCard client={remote} /> : <p className="rounded-2xl bg-white/5 p-4 text-center text-sm text-white/60">{remoteError}</p>}
      {remoteMatches.length > 0 && <MatchList kind="remote" matches={remoteMatches} me={remote?.userId ?? null} />}

      {local && <HotSeatCard client={local} />}
      {localMatches.length > 0 && <MatchList kind="local" matches={localMatches} me={null} />}
    </main>
  )
}

function OnlineCard({ client }: { client: GameClient }) {
  const navigate = useNavigate()
  const [name, setName] = useState(loadNickname)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(e: FormEvent) {
    e.preventDefault()
    const nick = name.trim()
    if (!nick) return
    setBusy(true)
    setError(null)
    saveNickname(nick)
    try {
      const view = await client.createMatch({ p1Name: nick })
      navigate(matchPath('remote', view.id))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const cleanCode = code.trim().toUpperCase()

  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-white/5 p-4">
      <h2 className="font-display text-xl font-semibold">Desafiar um amigo</h2>
      <form onSubmit={create} className="flex flex-col gap-3">
        <input value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className={inputClass} autoComplete="nickname" />
        <Button type="submit" disabled={!name.trim() || busy}>
          Criar partida
        </Button>
      </form>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (cleanCode.length === 6) navigate(`/p/${cleanCode}`)
        }}
        className="flex gap-2"
      >
        <input value={code} maxLength={6} onChange={(e) => setCode(e.target.value)} placeholder="Tenho um código" className={`${inputClass} uppercase tracking-widest`} autoComplete="off" />
        <Button type="submit" variant="secondary" disabled={cleanCode.length !== 6}>
          Entrar
        </Button>
      </form>
    </section>
  )
}

function HotSeatCard({ client }: { client: GameClient }) {
  const navigate = useNavigate()
  const [names, setNames] = useState(loadNames)
  const [busy, setBusy] = useState(false)

  const n1 = names[0].trim()
  const n2 = names[1].trim()
  const valid = n1.length > 0 && n2.length > 0 && n1.toLowerCase() !== n2.toLowerCase()

  async function start(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    try {
      localStorage.setItem(NAMES_KEY, JSON.stringify([n1, n2]))
    } catch {
      // Ignora.
    }
    try {
      const view = await client.createMatch({ p1Name: n1, p2Name: n2 })
      navigate(matchPath('local', view.id))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={start} className="flex flex-col gap-3 rounded-3xl bg-white/5 p-4">
      <h2 className="font-display text-xl font-semibold">
        Jogar no mesmo celular <span className="align-middle text-xs font-normal text-white/50">(dev)</span>
      </h2>
      {[0, 1].map((i) => (
        <label key={i} className="flex items-center gap-3">
          <span
            className="font-display grid size-9 shrink-0 place-items-center rounded-full font-bold text-coringa-deep"
            style={{ background: PLAYER_ACCENT[(i + 1) as 1 | 2] }}
          >
            {i + 1}
          </span>
          <input
            value={names[i]}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setNames((prev) => (i === 0 ? [e.target.value, prev[1]] : [prev[0], e.target.value]))}
            placeholder={`Nome do jogador ${i + 1}`}
            className={inputClass}
            autoComplete="off"
          />
        </label>
      ))}
      <Button type="submit" variant="secondary" disabled={!valid || busy} className="mt-1">
        Começar partida
      </Button>
    </form>
  )
}

function MatchList({ kind, matches, me }: { kind: ClientKind; matches: MatchView[]; me: string | null }) {
  const active = matches.filter((m) => m.status !== 'ENDED')
  const ended = matches.filter((m) => m.status === 'ENDED').slice(0, 5)
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold text-white/80">{kind === 'remote' ? 'Suas partidas online' : 'Partidas no mesmo celular'}</h2>
      <ul className="flex flex-col gap-2">
        {[...active, ...ended].map((m) => {
          const myTurn = me !== null && m.status !== 'ENDED' && playerNoOf(m, me) === m.turnOf && m.players[2] !== null
          return (
            <li key={m.id}>
              <Link
                to={matchPath(kind, m.id)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition hover:bg-white/10 ${myTurn ? 'bg-coringa-gold/15 ring-1 ring-coringa-gold/50' : 'bg-white/5'}`}
              >
                <span className="min-w-0 truncate font-semibold">
                  <span style={{ color: PLAYER_ACCENT[1] }}>{m.players[1].name}</span>
                  <span className="text-white/50"> × </span>
                  <span style={{ color: PLAYER_ACCENT[2] }}>{m.players[2]?.name ?? '…'}</span>
                </span>
                <span className="font-display ml-auto text-lg font-bold">
                  {m.players[1].crowns.length}–{m.players[2]?.crowns.length ?? 0}
                </span>
                <span className={`w-24 text-right text-xs ${myTurn ? 'font-bold text-coringa-gold' : 'text-white/60'}`}>{statusText(m, me)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function statusText(m: MatchView, me: string | null) {
  if (m.status === 'ENDED') return m.winner ? `${m.players[m.winner]?.name} venceu` : 'Encerrada'
  if (!m.players[2]) return 'Aguardando amigo'
  if (me !== null && playerNoOf(m, me) === m.turnOf) return 'Sua vez!'
  return `Vez de ${m.players[m.turnOf]?.name ?? '…'}`
}
