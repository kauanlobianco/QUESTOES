import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { RULES, playerNoOf, type Area, type GameEvent, type MatchView, type PlayerNo, type PublicQuestion, type Slice } from '../engine'
import { AREA_INFO } from '../content/areas'
import { ClientError, type ClientCommand, type CommandResult, type GameClient } from '../game/client'
import { serverNow } from '../game/clock'
import { useClients, type ClientKind } from '../game/GameClientContext'
import { matchPath } from '../game/paths'
import { freshRivalEvents, handsTurnTo, latestAt, loadSeen, saveSeen, turnSummary } from '../game/rivalNews'
import { Loading, LoadingScreen } from '../ui/Loading'
import { PlayerBoard } from '../ui/PlayerBoard'
import { SoundToggle } from '../ui/SoundToggle'
import { CloseIcon, FlagIcon } from '../ui/icons'
import { CrownChoiceView } from './match/CrownChoiceView'
import { DuelIntroView } from './match/DuelIntroView'
import { EndedView } from './match/EndedView'
import { InviteBanner, WaitingView } from './match/WaitingView'
import { CrownWonOverlay, DuelResultOverlay, HandoffOverlay, YourTurnOverlay, type HandoffReason, type Moment } from './match/Overlays'
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

const TITLE = 'Mestre dos Negócios'

export const RemoteMatchScreen = () => <MatchScreen kind="remote" />
export const LocalMatchScreen = () => <MatchScreen kind="local" />

export function MatchScreen({ kind }: { kind: ClientKind }) {
  const { id = '' } = useParams()
  const clients = useClients()
  const client = clients[kind]
  if (!client) {
    if (clients.connecting) return <LoadingScreen text="Abrindo partida…" />
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
  // Revanche troca o id: a partida nova começa do zero.
  return <Match key={id} id={id} client={client} />
}

function Match({ id, client }: { id: string; client: GameClient }) {
  const navigate = useNavigate()
  const hotSeat = client.mode === 'local'

  const [view, setView] = useState<MatchView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [spin, setSpin] = useState<SpinState | null>(null)
  const [answer, setAnswer] = useState<AnswerState | null>(null)
  const [moments, setMoments] = useState<Moment[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const [channelDown, setChannelDown] = useState(false)
  const spinResult = useRef<CommandResult | null>(null)
  const spinning = useRef(false)
  const answering = useRef(false)
  const inFlight = useRef(false)
  const idle = useRef(true)
  const incoming = useRef<MatchView | null>(null)
  /** Evento mais novo do log que este navegador já mostrou (online). */
  const seen = useRef<number | null>(hotSeat ? null : loadSeen(id))
  /** Já recebeu o primeiro estado; avisos de entrada só valem ao vivo (revanche já nasce com os dois). */
  const loaded = useRef(false)

  const markSeen = useCallback((v: MatchView) => {
    const at = latestAt(v.log, seen.current)
    if (at === null || at === seen.current) return
    seen.current = at
    saveSeen(v.id, at)
  }, [])

  // Estado vindo do servidor que não é resposta a um comando deste jogador:
  // o que o rival fez desde a última olhada vira destaque na tela.
  const receive = useCallback(
    (v: MatchView) => {
      const me = hotSeat ? null : playerNoOf(v, client.userId ?? '')
      if (me) {
        const events = freshRivalEvents(v.log, me, seen.current)
        if (loaded.current && events.some((e) => e.type === 'PLAYER_JOINED')) setToast(`${v.players[2]?.name ?? 'Seu amigo'} aceitou o desafio!`)
        const news = rivalMoments(v, me, events)
        if (news.length) setMoments((m) => [...m, ...news])
        markSeen(v)
      }
      loaded.current = true
      setView((cur) => (!cur || v.seq > cur.seq ? v : cur))
    },
    [client, hotSeat, markSeen],
  )

  // Atualizações do rival só entram na tela entre animações.
  const deliver = useCallback(
    (v: MatchView) => {
      if (idle.current) receive(v)
      else incoming.current = v
    },
    [receive],
  )

  useEffect(() => {
    idle.current = !spin && !answer && moments.length === 0 && !busy
    if (idle.current && incoming.current) {
      receive(incoming.current)
      incoming.current = null
    }
  }, [spin, answer, moments, busy, receive])

  // Ao reconectar, relê a partida: jogadas feitas durante a queda não chegam pelo Realtime.
  const wasDown = useRef(false)
  useEffect(() => {
    if (hotSeat) return
    return client.subscribe(id, deliver, (live) => {
      setChannelDown(!live)
      if (live && wasDown.current) client.getMatch(id).then(deliver, () => {})
      wasDown.current = !live
    })
  }, [client, id, hotSeat, deliver])

  // Realtime pode cair com a aba em segundo plano ou sem rede: relê ao voltar.
  useEffect(() => {
    if (hotSeat) return
    const refresh = () => client.getMatch(id).then(deliver, () => {})
    const onVisible = () => {
      if (!document.hidden) refresh()
    }
    const onOnline = () => {
      setOffline(false)
      refresh()
    }
    const onOffline = () => setOffline(true)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [client, id, hotSeat, deliver])

  // Rival sumiu no meio da pergunta: ao fim do prazo, a leitura grava o tempo esgotado.
  const myNo = view && !hotSeat ? playerNoOf(view, client.userId ?? '') : null
  const rivalDeadline =
    myNo && view?.status === 'ACTIVE' && view.current && view.turnOf !== myNo ? view.current.servedAt + view.current.timeLimitMs + RULES.graceMs : null
  useEffect(() => {
    if (rivalDeadline === null) return
    const t = setTimeout(() => client.getMatch(id).then(deliver, () => {}), Math.max(0, rivalDeadline - serverNow()) + 1000)
    return () => clearTimeout(t)
  }, [rivalDeadline, client, id, deliver])

  const myTurnOnline = !!myNo && view?.status === 'ACTIVE' && !!view.players[2] && view.turnOf === myNo
  useEffect(() => {
    document.title = myTurnOnline ? `Sua vez! · ${TITLE}` : TITLE
    return () => {
      document.title = TITLE
    }
  }, [myTurnOnline])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    let alive = true
    client
      .getMatch(id)
      .then((v) => {
        if (!alive) return
        receive(v)
        const started = v.log.some((e) => e.type !== 'PLAYER_JOINED')
        if (hotSeat && v.status !== 'ENDED' && started) setMoments([{ type: 'handoff', to: v.turnOf, reason: 'RESUME' }])
      })
      .catch((e) => alive && setError(e instanceof ClientError ? e.message : 'Não foi possível abrir a partida.'))
    return () => {
      alive = false
    }
  }, [client, id, hotSeat, receive])

  const run = useCallback(
    async (cmd: ClientCommand): Promise<CommandResult | null> => {
      // Toque duplo: ignora enquanto outro comando está a caminho.
      if (inFlight.current) return null
      inFlight.current = true
      setBusy(true)
      setError(null)
      try {
        const r = await client.send(id, cmd)
        // O que veio na resposta é mostrado por este jogador; não conta como novidade do rival.
        if (!hotSeat) markSeen(r.view)
        return r
      } catch (e) {
        setError(e instanceof ClientError ? e.message : 'Algo deu errado. Tente de novo.')
        client.getMatch(id).then(receive, () => {})
        return null
      } finally {
        inFlight.current = false
        setBusy(false)
      }
    },
    [client, id, hotSeat, markSeen, receive],
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
          <Loading text="Abrindo partida…" />
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
    setError(null)
    try {
      const next = hotSeat
        ? await client.createMatch({ p1Name: view.players[1].name, p2Name: view.players[2]?.name })
        : client.rematch
          ? await client.rematch(view.id)
          : await client.createMatch({ p1Name: myName })
      navigate(matchPath(client.mode, next.id))
    } catch (e) {
      setError(e instanceof ClientError ? e.message : 'Não foi possível abrir a revanche.')
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
      {moment.type === 'yourTurn' && <YourTurnOverlay key="turn" view={view} me={me} lines={moment.lines} onDone={dismissMoment} />}
    </AnimatePresence>
  )

  if (view.status === 'ENDED' && !moment && !answer) {
    return (
      <>
        <EndedView view={view} me={hotSeat ? null : me} busy={busy} onRematch={onRematch} onHome={() => navigate('/')} />
        {error && <ErrorToast message={error} onClose={() => setError(null)} />}
      </>
    )
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
        <div className="flex items-center">
          <SoundToggle />
          <button type="button" onClick={onResign} disabled={busy} className="rounded-full p-2 hover:bg-white/10" aria-label="Desistir">
            <FlagIcon size={20} />
          </button>
        </div>
      </header>

      {!hotSeat && <ConnectionBanner offline={offline} reconnecting={channelDown} />}

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

      {toast && <InfoToast message={toast} />}
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

/** Aviso de rede; espera um pouco para não piscar em quedas curtas. */
function ConnectionBanner({ offline, reconnecting }: { offline: boolean; reconnecting: boolean }) {
  const down = offline || reconnecting
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(down), down ? 2000 : 0)
    return () => clearTimeout(t)
  }, [down])
  if (!visible) return null
  return (
    <p role="status" className="rounded-2xl bg-amber-500/20 px-4 py-2 text-center text-sm font-semibold text-amber-100 ring-1 ring-amber-400/50">
      {offline ? 'Sem internet. A partida volta sozinha quando a conexão voltar.' : 'Reconectando ao jogo…'}
    </p>
  )
}

function InfoToast({ message }: { message: string }) {
  return (
    <p role="status" className="fixed inset-x-4 top-4 z-30 mx-auto max-w-md rounded-2xl bg-emerald-600 px-4 py-3 text-center font-semibold shadow-xl">
      {message}
    </p>
  )
}

/** Destaques do que o rival fez, na ordem: coroas, duelos e, por fim, "Sua vez!". */
function rivalMoments(v: MatchView, me: PlayerNo, events: GameEvent[]): Moment[] {
  const out: Moment[] = []
  for (const e of events) {
    if (e.type === 'CROWN_WON') out.push({ type: 'crown', player: e.player, area: e.area })
    if (e.type === 'DUEL_ENDED') out.push({ type: 'duel', result: e.result })
  }
  if (handsTurnTo(v, me, events)) out.push({ type: 'yourTurn', lines: turnSummary(v, me, events, (a) => AREA_INFO[a].name) })
  return out
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
