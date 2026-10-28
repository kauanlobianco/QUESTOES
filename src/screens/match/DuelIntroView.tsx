import { motion } from 'motion/react'
import type { Area, MatchView, PlayerNo } from '../../engine'
import { AREA_INFO } from '../../content/areas'
import { Button } from '../../ui/Button'
import { Ficha } from '../../ui/Ficha'
import { SwordsIcon } from '../../ui/icons'

interface DuelIntroViewProps {
  view: MatchView
  me: PlayerNo
  busy: boolean
  onStart: () => void
}

/** Antes de cada bloco do duelo: apostas, progresso e botão para começar. */
export function DuelIntroView({ view, me, busy, onStart }: DuelIntroViewProps) {
  const duel = view.duel!
  const challenger = view.players[duel.challenger]!
  const challenged = view.players[duel.challenged]!
  const answered = duel.answered[me]
  const final = duel.kind === 'FINAL'

  const subtitle = final
    ? `Empate em personagens após ${view.maxRounds} rodadas. Quem acertar mais vence a partida.`
    : me === duel.challenger
      ? `Você quer ${AREA_INFO[duel.requested!].name} e arrisca ${AREA_INFO[duel.offered!].name}.`
      : `${challenger.name} quer seu ${AREA_INFO[duel.requested!].name} e arrisca ${AREA_INFO[duel.offered!].name}.`

  return (
    <motion.div className="flex flex-1 flex-col items-center justify-center gap-6 text-center" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
      <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 2.4 }}>
        <SwordsIcon size={56} className="text-coringa-gold" />
      </motion.div>
      <div>
        <h2 className="font-display text-3xl font-bold">{final ? 'Duelo final!' : 'Duelo!'}</h2>
        <p className="mt-1 text-white/75">
          {challenger.name} × {challenged.name}
        </p>
      </div>

      {!final && (
        <div className="flex items-center gap-6">
          <Stake area={duel.offered!} label={`Aposta de ${challenger.name}`} />
          <span className="font-display text-2xl font-bold text-white/50">vs</span>
          <Stake area={duel.requested!} label={`Alvo em ${challenged.name}`} />
        </div>
      )}

      <p className="max-w-xs text-sm text-white/80">{subtitle}</p>

      <p className="font-display text-lg">
        {answered === 0 ? `${duel.total} perguntas · 20s cada` : `Pergunta ${answered + 1} de ${duel.total}`}
      </p>

      <Button onClick={onStart} disabled={busy} className="min-w-48">
        {answered === 0 ? 'Começar' : 'Continuar'}
      </Button>
    </motion.div>
  )
}

function Stake({ area, label }: { area: Area; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Ficha area={area} size={64} />
      <span className="text-xs font-semibold text-white/70">{label}</span>
    </div>
  )
}
