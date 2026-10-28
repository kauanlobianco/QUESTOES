import { motion } from 'motion/react'
import { useEffect } from 'react'
import type { Area, DuelResult, MatchView, PlayerNo, TurnEndReason } from '../../engine'
import { AREA_INFO } from '../../content/areas'
import { Button } from '../../ui/Button'
import { Ficha } from '../../ui/Ficha'
import { burst } from '../../ui/confetti'
import { play, vibrate } from '../../ui/feedback'
import { SwordsIcon } from '../../ui/icons'
import { PLAYER_ACCENT } from '../../ui/theme'

/** Momento de destaque mostrado entre uma jogada e a próxima tela. */
export type Moment =
  | { type: 'crown'; player: PlayerNo; area: Area }
  | { type: 'duel'; result: DuelResult }
  | { type: 'handoff'; to: PlayerNo; reason: HandoffReason }
  /** Online: o rival terminou e a vez voltou para quem estava esperando. */
  | { type: 'yourTurn'; lines: string[] }

export type HandoffReason = TurnEndReason | 'DUEL' | 'FINAL_DUEL' | 'RESUME'

function Shell({ children, background }: { children: React.ReactNode; background?: string }) {
  return (
    <motion.div
      className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-6 overflow-y-auto p-6 text-center"
      style={{ background: background ?? 'var(--color-coringa-deep)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {children}
    </motion.div>
  )
}

export function CrownWonOverlay({ view, player, area, onDone }: { view: MatchView; player: PlayerNo; area: Area; onDone: () => void }) {
  const info = AREA_INFO[area]
  useEffect(() => {
    burst([info.hex, '#fbbf24', '#ffffff'])
    play('crown')
    vibrate([80, 50, 140])
  }, [info.hex])
  return (
    <Shell background={`radial-gradient(circle at 50% 40%, ${info.color} 0%, var(--color-${area}-deep) 70%)`}>
      <motion.img
        src={info.hero}
        alt={info.name}
        className="h-[38vh] max-h-80 object-contain drop-shadow-2xl"
        initial={{ scale: 0.2, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14 }}
      />
      <div>
        <p className="font-display text-lg text-white/85">{view.players[player]?.name} conquistou</p>
        <h2 className="font-display text-4xl font-bold">{info.name}!</h2>
        <p className="mt-2 text-white/80">
          {view.players[player]?.crowns.length} de 6 personagens
        </p>
      </div>
      <Button onClick={onDone} autoFocus>
        Continuar
      </Button>
    </Shell>
  )
}

export function DuelResultOverlay({ view, result, onDone }: { view: MatchView; result: DuelResult; onDone: () => void }) {
  const winner = view.players[result.winner]!
  const a = view.players[result.challenger]!
  const b = view.players[result.challenged]!
  const prize = result.kind === 'NORMAL' ? (result.winner === result.challenger ? result.requested : result.offered) : null

  useEffect(() => {
    burst()
    play('duel')
    vibrate([60, 40, 60, 40, 120])
  }, [])

  const tie =
    result.tieBreak === 'TIME'
      ? 'Empate em acertos: venceu quem respondeu mais rápido.'
      : result.tieBreak === 'DEFENDER'
        ? 'Empate total: a vitória fica com quem defendia.'
        : null

  return (
    <Shell>
      <SwordsIcon size={48} className="text-coringa-gold" />
      <h2 className="font-display text-3xl font-bold">{winner.name} venceu o duelo!</h2>
      <div className="flex items-end gap-8">
        <Score name={a.name} score={result.score[result.challenger]} ms={result.totalMs[result.challenger]} accent={PLAYER_ACCENT[result.challenger]} />
        <Score name={b.name} score={result.score[result.challenged]} ms={result.totalMs[result.challenged]} accent={PLAYER_ACCENT[result.challenged]} />
      </div>
      {tie && <p className="max-w-xs text-sm text-white/75">{tie}</p>}
      {prize && (
        <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
          <Ficha area={prize} size={44} />
          <p className="text-left font-semibold">
            {winner.name} leva {AREA_INFO[prize].name}
          </p>
        </div>
      )}
      <Button onClick={onDone} autoFocus>
        Continuar
      </Button>
    </Shell>
  )
}

function Score({ name, score, ms, accent }: { name: string; score: number; ms: number; accent: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-display text-6xl font-bold" style={{ color: accent }}>
        {score}
      </span>
      <span className="font-semibold">{name}</span>
      <span className="text-xs text-white/60">{(ms / 1000).toFixed(1)}s</span>
    </div>
  )
}

const HANDOFF_TEXT: Record<HandoffReason, (prev: string) => string> = {
  WRONG: (p) => `${p} errou.`,
  TIMEOUT: (p) => `O tempo de ${p} acabou.`,
  CROWN_LIMIT: (p) => `${p} já ganhou o personagem do primeiro turno.`,
  DUEL_SENT: (p) => `${p} desafiou você para um duelo!`,
  DUEL: (p) => `${p} desafiou você para um duelo!`,
  FINAL_DUEL: () => 'Fim das rodadas com empate. Hora do duelo final!',
  RESUME: () => 'Partida retomada.',
}

/** Hot-seat: pede para passar o aparelho antes de revelar a próxima tela. */
export function HandoffOverlay({ view, to, reason, onDone }: { view: MatchView; to: PlayerNo; reason: HandoffReason; onDone: () => void }) {
  const next = view.players[to]
  const prev = view.players[to === 1 ? 2 : 1]
  return (
    <Shell>
      <p className="text-white/75">{HANDOFF_TEXT[reason](prev?.name ?? 'Rival')}</p>
      <div>
        <p className="font-display text-lg text-white/80">Passe o celular para</p>
        <motion.h2
          className="font-display text-5xl font-bold"
          style={{ color: PLAYER_ACCENT[to] }}
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
          {next?.name}
        </motion.h2>
      </div>
      <Button onClick={onDone} autoFocus className="min-w-48">
        Sou {next?.name}, começar
      </Button>
    </Shell>
  )
}

/** Online: resumo do turno do rival quando a vez volta. */
export function YourTurnOverlay({ view, me, lines, onDone }: { view: MatchView; me: PlayerNo; lines: string[]; onDone: () => void }) {
  useEffect(() => {
    play('turn')
    vibrate(150)
  }, [])
  return (
    <Shell>
      <motion.h2
        className="font-display text-5xl font-bold"
        style={{ color: PLAYER_ACCENT[me] }}
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
      >
        Sua vez!
      </motion.h2>
      {lines.length > 0 && (
        <ul className="flex max-w-xs flex-col gap-2 text-white/85">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <p className="font-display text-lg font-semibold">
        {view.players[1].crowns.length} × {view.players[2]?.crowns.length ?? 0} personagens
      </p>
      <Button onClick={onDone} autoFocus className="min-w-48">
        Jogar
      </Button>
    </Shell>
  )
}
