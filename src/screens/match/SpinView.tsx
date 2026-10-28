import { AnimatePresence, motion } from 'motion/react'
import type { Slice } from '../../engine'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { Wheel } from '../../ui/Wheel'
import { sliceInfo } from '../../ui/theme'

interface SpinViewProps {
  playerName: string
  canSpin: boolean
  spinning: boolean
  target: Slice | null
  /** Fatia já parou: mostra o nome antes de seguir. */
  landed: boolean
  onSpin?: () => void
  onLanded: () => void
}

export function SpinView({ playerName, canSpin, spinning, target, landed, onSpin, onLanded }: SpinViewProps) {
  const info = target ? sliceInfo(target) : null
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <p className="font-display text-center text-xl font-semibold">
        {canSpin ? `${playerName}, gire a roleta!` : `Vez de ${playerName}`}
      </p>

      <Wheel spinning={spinning} target={target} onLanded={onLanded} />

      <div className="grid h-16 place-items-center">
        <AnimatePresence mode="wait">
          {landed && info ? (
            <div key="landed" className="flex items-center gap-1">
              {target !== 'coringa' && target && <Mascot area={target} size={72} intro="enter" fidgets={false} />}
              <motion.p
                className="font-display rounded-2xl px-5 py-2 text-2xl font-bold shadow-lg"
                style={{ background: info.color }}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              >
                {info.name}!
              </motion.p>
            </div>
          ) : (
            canSpin && (
              <motion.div key="btn" exit={{ opacity: 0, scale: 0.9 }}>
                <Button onClick={onSpin} disabled={spinning} className="min-w-44 text-xl">
                  {spinning ? 'Girando…' : 'Girar'}
                </Button>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
