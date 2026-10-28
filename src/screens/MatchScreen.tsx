import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { playerNoOf, type Area, type MatchView, type PublicQuestion, type Slice } from '../engine'
import { ClientError, type ClientCommand, type CommandResult, type GameClient } from '../game/client'
import { useClients, type ClientKind } from '../game/GameClientContext'
import { matchPath } from '../game/paths'
import { PlayerBoard } from '../ui/PlayerBoard'
import { CloseIcon, FlagIcon } from '../ui/icons'
import { CrownChoiceView } from './match/CrownChoiceView'
import { DuelIntroView } from './match/DuelIntroView'
import { EndedView } from './match/EndedView'
import { InviteBanner, WaitingView } from './match/WaitingView'
import { CrownWonOverlay, DuelResultOverlay, HandoffOverlay, type HandoffReason, type Moment } from './match/Overlays'
import { QuestionView } from './match/QuestionView'
import { SpinView } from './match/SpinView'

/** Pausa com o nome da fatia na tela antes de abrir a pergunta. */
const LANDED_PAUSE_MS = 600

interface SpinState {
  target: Slice | null
  landed: boolean
}

interface AnswerState {
  question: PublicQuestion
  chosen: number | null
  result: CommandResult | null
}

export function MatchScreen({ kind }: { kind: ClientKind }) {
  const clients = useClients()
  const client = clients[kind]
  if (!client) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="flex flex-col gap-4">
          <p className="font-display text-xl">{kind === 'remote' ? (clients.remoteError ?? 'Modo online indisponível.') : 'Modo local indisponível.'}</p>
          <Link to="/" className="underline">
            Voltar ao início
          </Link>
        </div>
      </main>
    )
  }
  return <Match client={client} />
}

function Match({ client }: { client: GameClient }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const hotSeat = client.mode === 'local'

  const [view, setView] = useState<MatchView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [spin, setSpin] = useState<SpinState | null>(null)
  const [answer, setAnswer] = useState<AnswerState | null>(null)
  const [moments, setMoments] = useState<Moment[]>([])
  const spinResult = useRef<CommandResult | null>(null)
  const spinning = useRef(false)
  const answering = useRef(false)
  const inFlight = useRef(false)
  const idle = useRef(true)
  const incoming = useRef<MatchView | null>(null)

  // Atualizações do rival chegam pelo Realtime; só entram na tela entre animações.
  const applyIfNewer = useCallback((v: MatchView) => setView((cur) => (!cur || v.seq > cur.seq ? v : cur)), [])

  useEffect(() => {
    idle.current = !spin && !answer && moments.length === 0 && !busy
    if (idle.current && incoming.current) {
      applyIfNewer(incoming.current)
      incoming.current = null
    }
  }, [spin, answer, moments, busy, applyIfNewer])

  useEffect(() => {
    if (hotSeat) return
    return client.subscribe(id, (v) => {
      if (idle.current) applyIfNewer(v)
      else incoming.current = v
    })
  }, [client, id, hotSeat, applyIfNewer])

  useEffect(() => {
    let alive = true
    client
      .getMatch(id)
      .then((v) => {
        if (!alive) return
        setView(v)
        const started = v.log.some((e) => e.type !== 'PLAYER_JOINED')
        if (hotSeat && v.status !== 'ENDED' && started) setMoments([{ type: 'handoff', to: v.turnOf, reason: 'RESUME' }])
      })
      .catch((e) => alive && setError(e instanceof ClientError ? e.message : 'Não foi possível abrir a partida.'))
    return () => {
      alive = false
    }
  }, [client, id, hotSeat])

  const run = useCallback(
    async (cmd: ClientCommand): Promise<CommandResult | null> => {
      // Toque duplo: ignora enquanto outro comando está a caminho.
      if (inFlight.current) return null
      inFlight.current = true
      setBusy(true)
      setError(null)
      try {
        return await client.send(id, cmd)
      } catch (e) {
        setError(e instanceof ClientError ? e.message : 'Algo deu errado. Tente de novo.')
        client.getMatch(id).then(setView, () => {})
        return null
      } finally {
        inFlight.current = false
        setBusy(false)
      }
    },
    [client, id],
  )

  const commit = useCallback(
    (prev: MatchView, r: CommandResult) => {
      setView(r.view)
      setMoments(deriveMoments(prev, r, hotSeat))
    },
    [hotSeat],
  )

  if (!view) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        {error ? (
          <div className="flex flex-col gap-4">
            <p className="font-display text-xl">{error}</p>
            <Link to="/" className="underline">
              Voltar ao início
            </Link>
          </div>
        ) : (
          <p className="font-display animate-pulse text-xl">Carregando…</p>
        )}
      </main>
    )
  }

  // No hot-seat o jogador da tela é sempre o da vez; online, é o dono da sessão.
  const me = hotSeat ? view.turnOf : (playerNoOf(view, client.userId ?? '') ?? 1)
  const isMyTurn = hotSeat || view.turnOf === me
  const myName = view.players[me]?.name ?? ''
  const turnName = view.players[view.turnOf]?.name ?? 'seu amigo'
  const moment = moments[0]
  const dismissMoment = () => setMoments((m) => m.slice(1))

  // ---------- Ações ----------

  async function onSpin() {
    if (spinning.current) return
    spinning.current = true
    setSpin({ target: null, landed: false })
    const r = await run({ type: 'SPIN' })
    if (!r?.spin) {
      spinning.current = false
      return setSpin(null)
    }
    spinResult.current = r
    setSpin({ target: r.spin, landed: false })
  }

  function onLanded() {
    setSpin((s) => s && { ...s, landed: true })
    setTimeout(() => {
      const r = spinResult.current
      spinResult.current = null
      spinning.current = false
      setSpin(null)
      if (r) setView(r.view)
    }, LANDED_PAUSE_MS)
  }

  async function onAnswer(option: number | null) {
    const question = view?.current
    if (!question || answering.current) return
    answering.current = true
    setAnswer({ question, chosen: option, result: null })
    const r = await run({ type: 'ANSWER', option })
    answering.current = false
    if (!r) return setAnswer(null)
    setAnswer({ question, chosen: option, result: r })
  }

  async function onContinueAnswer() {
    const r = answer?.result
    if (!r || !view) return
    const prev = view
    // No duelo, o mesmo jogador segue direto para a próxima pergunta, sem passar pela intro.
    const d = r.view.duel
    const sameStage = d && prev.duel && d.stage === prev.duel.stage && r.view.turnOf === prev.turnOf
    if (r.view.phase === 'DUEL' && sameStage && !r.view.current && d.answered[d.stage] < d.total) {
      const n = await run({ type: 'DUEL_NEXT' })
      setAnswer(null)
      if (n) setView(n.view)
      else commit(prev, r)
      return
    }
    commit(prev, r)
    setAnswer(null)
  }

  async function simple(cmd: ClientCommand) {
    const r = await run(cmd)
    if (r && view) commit(view, r)
  }

  async function onResign() {
    if (!confirm(`${myName}, desistir da partida? O rival vence.`)) return
    await simple({ type: 'RESIGN' })
  }

  async function onRematch() {
    if (!view) return
    setBusy(true)
    try {
      const next = hotSeat
        ? await client.createMatch({ p1Name: view.players[1].name, p2Name: view.players[2]?.name })
        : await client.createMatch({ p1Name: myName })
      navigate(matchPath(client.mode, next.id))
      setView(next)
      setMoments([])
    } finally {
      setBusy(false)
    }
  }

  // ---------- Tela ----------

  const overlay = moment && (
    <AnimatePresence>
      {moment.type === 'crown' && <CrownWonOverlay key="crown" view={view} player={moment.player} area={moment.area} onDone={dismissMoment} />}
      {moment.type === 'duel' && <DuelResultOverlay key="duel" view={view} result={moment.result} onDone={dismissMoment} />}
      {moment.type === 'handoff' && <HandoffOverlay key="handoff" view={view} to={moment.to} reason={moment.reason} onDone={dismissMoment} />}
    </AnimatePresence>
  )

  if (view.status === 'ENDED' && !moment && !answer) {
    return <EndedView view={view} busy={busy} onRematch={onRematch} onHome={() => navigate('/')} />
  }

  const question = answer?.question ?? (isMyTurn ? view.current : null)
  if (question && !moment) {
    const result = answer?.result ?? null
    return (
      <>
        <QuestionView
          question={question}
          playerName={myName}
          chosen={answer?.chosen ?? null}
          reveal={result?.reveal ?? null}
          waiting={!!answer && !result}
          duelProgress={view.duel ? { index: view.duel.answered[me] + 1, total: view.duel.total } : undefined}
          continueLabel={result ? continueLabel(view, result, hotSeat) : ''}
          onAnswer={onAnswer}
          onContinue={onContinueAnswer}
        />
        {error && <ErrorToast message={error} onClose={() => setError(null)} />}
      </>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between text-sm text-white/70">
        <Link to="/" className="rounded-full p-2 hover:bg-white/10" aria-label="Sair para o início">
          <CloseIcon size={20} />
        </Link>
        <span className="font-display font-semibold">
          Rodada {Math.min(view.round, view.maxRounds)}/{view.maxRounds}
        </span>
        <button type="button" onClick={onResign} disabled={busy} className="rounded-full p-2 hover:bg-white/10" aria-label="Desistir">
          <FlagIcon size={20} />
        </button>
      </header>

      {!hotSeat && !view.players[2] && <InviteBanner code={view.code} />}

      <div className="flex gap-2">
        <PlayerBoard no={1} player={view.players[1]} active={view.turnOf === 1} />
        <PlayerBoard no={2} player={view.players[2]} active={view.turnOf === 2} />
      </div>

      {!isMyTurn && !spin ? (
        <WaitingView view={view} turnName={turnName} me={me} />
      ) : (
        <>
      {(spin || view.phase === 'SPIN') && (
        <SpinView
          playerName={turnName}
          canSpin={isMyTurn}
          spinning={!!spin}
          target={spin?.target ?? null}
          landed={!!spin?.landed}
          onSpin={onSpin}
          onLanded={onLanded}
        />
      )}
      {!spin && view.phase === 'CROWN_CHOICE' && (
        <CrownChoiceView
          view={view}
          me={me}
          busy={busy}
          onChooseCrown={(area: Area) => simple({ type: 'CHOOSE_CROWN', area })}
          onStartDuel={(requested, offered) => simple({ type: 'START_DUEL', requested, offered })}
        />
      )}
      {!spin && view.phase === 'DUEL' && view.duel && <DuelIntroView view={view} me={me} busy={busy} onStart={() => simple({ type: 'DUEL_NEXT' })} />}
        </>
      )}

      {error && <ErrorToast message={error} onClose={() => setError(null)} />}
      {overlay}
    </main>
  )
}

function ErrorToast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-md rounded-2xl bg-rose-600 px-4 py-3 text-left font-semibold shadow-xl"
    >
      {message}
    </button>
  )
}

function continueLabel(prev: MatchView, r: CommandResult, hotSeat: boolean): string {
  const v = r.view
  if (v.status === 'ENDED') return 'Ver resultado'
  if (r.events.some((e) => e.type === 'CROWN_WON' || e.type === 'DUEL_ENDED')) return 'Continuar'
  if (v.turnOf !== prev.turnOf) return hotSeat ? 'Passar a vez' : 'Continuar'
  if (v.phase === 'CROWN_CHOICE') return 'Escolher personagem'
  if (v.phase === 'DUEL') return 'Próxima pergunta'
  return 'Girar de novo'
}

function deriveMoments(prev: MatchView, r: CommandResult, hotSeat: boolean): Moment[] {
  const out: Moment[] = []
  for (const e of r.events) {
    if (e.type === 'CROWN_WON') out.push({ type: 'crown', player: e.player, area: e.area })
    if (e.type === 'DUEL_ENDED') out.push({ type: 'duel', result: e.result })
  }
  const v = r.view
  if (hotSeat && v.status !== 'ENDED' && v.turnOf !== prev.turnOf) {
    let reason: HandoffReason = 'RESUME'
    const turnEnded = r.events.find((e) => e.type === 'TURN_ENDED')
    if (v.duel?.kind === 'FINAL') reason = 'FINAL_DUEL'
    else if (v.phase === 'DUEL' && v.duel?.stage === v.turnOf) reason = 'DUEL'
    else if (turnEnded?.type === 'TURN_ENDED') reason = turnEnded.reason
    out.push({ type: 'handoff', to: v.turnOf, reason })
  }
  return out
}
