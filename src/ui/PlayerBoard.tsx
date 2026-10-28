import { motion } from 'motion/react'
import { AREAS, RULES, type PlayerNo, type PlayerState } from '../engine'
import { Ficha } from './Ficha'
import { CrownIcon } from './icons'
import { PLAYER_ACCENT } from './theme'

interface PlayerBoardProps {
  no: PlayerNo
  player: PlayerState | null
  active: boolean
}

/** Versão digital do tabuleiro físico: medidor 1-2-3-👑 e os 6 personagens. */
export function PlayerBoard({ no, player, active }: PlayerBoardProps) {
  const accent = PLAYER_ACCENT[no]
  return (
    <motion.section
      layout
      className="flex-1 rounded-2xl bg-white/5 p-2.5 ring-2 transition-colors"
      style={{ ['--tw-ring-color' as string]: active ? accent : 'transparent' }}
      aria-label={`Placar de ${player?.name ?? 'convidado'}`}
    >
      <div className="flex items-center gap-2">
        <span
          className="font-display grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold text-coringa-deep"
          style={{ background: accent }}
        >
          {player?.name.slice(0, 1).toUpperCase() ?? '?'}
        </span>
        <span className="font-display truncate text-base font-semibold">{player?.name ?? 'Aguardando…'}</span>
        <span className="ml-auto shrink-0 text-xs font-bold text-coringa-gold" aria-label="XP">
          {player?.stats.xp ?? 0} XP
        </span>
        <span className="font-display text-lg font-bold" style={{ color: accent }}>
          {player?.crowns.length ?? 0}
        </span>
      </div>

      <ChargeMeter charges={player?.charges ?? 0} accent={accent} />

      <div className="mt-2 grid grid-cols-6 gap-1">
        {AREAS.map((a) => (
          <Ficha key={a} area={a} owned={player?.crowns.includes(a)} size={26} className="mx-auto" />
        ))}
      </div>
    </motion.section>
  )
}

function ChargeMeter({ charges, accent }: { charges: number; accent: string }) {
  const full = charges >= RULES.chargesForCrown
  return (
    <div className="mt-2 flex items-center gap-1" aria-label={`Medidor: ${charges} de ${RULES.chargesForCrown}`}>
      {Array.from({ length: RULES.chargesForCrown }, (_, i) => (
        <motion.span
          key={i}
          className="h-2.5 flex-1 rounded-full"
          animate={{ backgroundColor: i < charges ? accent : 'rgba(255,255,255,0.12)', scaleY: i < charges ? 1 : 0.8 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        />
      ))}
      <motion.span animate={{ scale: full ? [1, 1.3, 1] : 1 }} transition={{ repeat: full ? Infinity : 0, duration: 1 }}>
        <CrownIcon size={18} style={{ color: full ? accent : 'rgba(255,255,255,0.25)' }} />
      </motion.span>
    </div>
  )
}
