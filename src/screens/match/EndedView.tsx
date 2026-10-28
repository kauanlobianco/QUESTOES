import { motion } from 'motion/react'
import { useEffect } from 'react'
import { AREAS, other, type EndedReason, type MatchView, type PlayerNo } from '../../engine'
import { Button } from '../../ui/Button'
import { Ficha } from '../../ui/Ficha'
import { celebrate } from '../../ui/confetti'
import { play } from '../../ui/feedback'
import { CrownIcon } from '../../ui/icons'
import { PLAYER_ACCENT } from '../../ui/theme'

const REASON_TEXT: Record<EndedReason, string> = {
  CROWNS: 'Conquistou os 6 personagens.',
  ROUNDS: 'Mais personagens ao fim das rodadas.',
  FINAL_DUEL: 'Venceu o duelo final.',
  RESIGNED: 'O rival desistiu.',
  EXPIRED: 'O rival ficou tempo demais sem jogar.',
}

interface EndedViewProps {
  view: MatchView
  /** Jogador desta tela (online); null no hot-seat. */
  me: PlayerNo | null
  onRematch: () => void
  onHome: () => void
  busy: boolean
}

export function EndedView({ view, me, onRematch, onHome, busy }: EndedViewProps) {
  const winner = view.winner ? view.players[view.winner] : null
  const rival = me ? view.players[other(me)] : null
  const rematchByRival = !!me && view.rematch?.by === other(me)

  const iLost = !!me && !!view.winner && view.winner !== me
  useEffect(() => {
    if (!winner) return
    if (iLost) return play('lose')
    celebrate()
    play('win')
  }, [winner, iLost])

  return (
    <motion.div className="mx-auto flex min-h-dvh max-w-md flex-col items-center gap-6 px-4 py-10 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div initial={{ y: -30, scale: 0.6 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 12 }}>
        <CrownIcon size={72} className="text-coringa-gold drop-shadow-lg" />
      </motion.div>

      {winner ? (
        <div>
          <h1 className="font-display text-4xl font-bold" style={{ color: PLAYER_ACCENT[view.winner!] }}>
            {winner.name}
          </h1>
          <p className="font-display text-2xl font-semibold">é Mestre dos Negócios!</p>
          <p className="mt-2 text-white/75">{REASON_TEXT[view.endedReason!]}</p>
        </div>
      ) : (
        <div>
          <h1 className="font-display text-3xl font-bold">Partida encerrada</h1>
          <p className="mt-2 text-white/75">Sem vencedor.</p>
        </div>
      )}

      <div className="flex w-full flex-col gap-3">
        {([1, 2] as PlayerNo[]).map((no) => (
          <Summary key={no} view={view} no={no} />
        ))}
      </div>

      <div className="mt-auto flex w-full flex-col gap-3">
        {rematchByRival && (
          <motion.p
            className="font-display text-xl font-semibold text-coringa-gold"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            {rival?.name} quer revanche!
          </motion.p>
        )}
        {view.players[2] && (
          <Button onClick={onRematch} disabled={busy}>
            {rematchByRival ? 'Aceitar revanche' : view.rematch ? 'Abrir revanche' : 'Revanche'}
          </Button>
        )}
        <Button variant="ghost" onClick={onHome}>
          Início
        </Button>
      </div>
    </motion.div>
  )
}

function Summary({ view, no }: { view: MatchView; no: PlayerNo }) {
  const p = view.players[no]
  if (!p) return null
  const pct = p.stats.answered ? Math.round((100 * p.stats.correct) / p.stats.answered) : 0
  return (
    <div className="rounded-2xl bg-white/5 p-3 text-left">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-lg font-semibold" style={{ color: PLAYER_ACCENT[no] }}>
          {p.name}
        </span>
        <span className="text-sm text-white/70">
          {p.stats.correct}/{p.stats.answered} acertos · {pct}% · <span className="font-bold text-coringa-gold">{p.stats.xp ?? 0} XP</span>
        </span>
      </div>
      <div className="mt-2 grid grid-cols-6 gap-1">
        {AREAS.map((a) => (
          <Ficha key={a} area={a} owned={p.crowns.includes(a)} size={34} className="mx-auto" />
        ))}
      </div>
    </div>
  )
}
