import { animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from 'motion/react'
import { useEffect, useRef } from 'react'
import { SLICES, type Slice } from '../engine'
import { AREA_INFO } from '../content/areas'
import { play } from './feedback'

const SEG = 360 / SLICES.length
const R = 96
/** Velocidade do giro enquanto espera o servidor (graus/s). */
const IDLE_SPEED = 720
/** Duração da desaceleração até a fatia sorteada. Cabe em RULES.spinRevealMs. */
export const LAND_DURATION_S = 2.6

const point = (deg: number, r = R) => {
  const a = (deg * Math.PI) / 180
  return `${(r * Math.sin(a)).toFixed(3)} ${(-r * Math.cos(a)).toFixed(3)}`
}

function slicePath(i: number) {
  const a0 = i * SEG - SEG / 2
  const a1 = i * SEG + SEG / 2
  return `M0 0 L${point(a0)} A${R} ${R} 0 0 1 ${point(a1)} Z`
}

interface WheelProps {
  /** `spinning` sem alvo gira indefinidamente; com alvo desacelera até ele. */
  spinning: boolean
  target: Slice | null
  onLanded?: () => void
}

export function Wheel({ spinning, target, onLanded }: WheelProps) {
  const rotation = useMotionValue(0)
  const controls = useRef<AnimationPlaybackControls | null>(null)
  const landed = useRef(onLanded)
  const reduced = useReducedMotion()

  useEffect(() => {
    landed.current = onLanded
  }, [onLanded])

  useEffect(() => {
    let last = Math.floor(rotation.get() / SEG)
    return rotation.on('change', (deg) => {
      const slice = Math.floor(deg / SEG)
      if (slice !== last) play('tick')
      last = slice
    })
  }, [rotation])

  useEffect(() => {
    if (!spinning || target) return
    const from = rotation.get()
    controls.current = animate(rotation, from + IDLE_SPEED * 60, { duration: 60, ease: 'linear' })
    return () => controls.current?.stop()
  }, [spinning, target, rotation])

  useEffect(() => {
    if (!target) return
    controls.current?.stop()
    const current = rotation.get()
    const want = -SLICES.indexOf(target) * SEG
    // Pelo menos 2 voltas; a curva começa na mesma velocidade do giro livre.
    const base = current + 720
    const offset = (((want - base) % 360) + 360) % 360
    const jitter = (Math.random() - 0.5) * SEG * 0.6
    const duration = reduced ? 0.8 : LAND_DURATION_S
    let done = false
    const finish = () => {
      if (done) return
      done = true
      play('land')
      landed.current?.()
    }
    controls.current = animate(rotation, base + offset + jitter, { duration, ease: [0.2, 0.6, 0.35, 1], onComplete: finish })
    // Aba em segundo plano não roda animação; o jogo não pode travar por isso.
    const fallback = setTimeout(finish, duration * 1000 + 400)
    return () => {
      clearTimeout(fallback)
      controls.current?.stop()
    }
  }, [target, rotation, reduced])

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[min(80vw,340px,42dvh)]">
      {/* Sombra fixa: um filtro no elemento que gira seria refeito a cada quadro. */}
      <div className="absolute inset-[0.5%] rounded-full shadow-[0_10px_25px_rgba(0,0,0,0.45)]" aria-hidden />
      <motion.div className="relative size-full will-change-transform" style={{ rotate: rotation }}>
        <svg viewBox="-100 -100 200 200" className="size-full">
          <circle r="99" fill="#fff" />
          {SLICES.map((slice, i) => (
            <g key={slice}>
              <path d={slicePath(i)} fill={slice === 'coringa' ? 'var(--color-coringa-deep)' : AREA_INFO[slice].color} stroke="#fff" strokeWidth="1.6" />
              <g transform={`rotate(${i * SEG})`}>
                {slice === 'coringa' ? (
                  <g transform={`translate(0 ${-R * 0.62})`}>
                    <circle r="17" fill="var(--color-coringa-gold)" />
                    <path d="M0 -11 L3 -3 L11 0 L3 3 L0 11 L-3 3 L-11 0 L-3 -3 Z" fill="var(--color-coringa-deep)" />
                  </g>
                ) : (
                  <image href={AREA_INFO[slice].ficha} x={-18} y={-R * 0.62 - 18} width={36} height={36} />
                )}
              </g>
            </g>
          ))}
          <circle r="15" fill="var(--color-coringa)" stroke="#fff" strokeWidth="3" />
          <circle r="6" fill="var(--color-coringa-gold)" />
        </svg>
      </motion.div>
      {/* Ponteiro fixo no topo */}
      <svg viewBox="0 0 40 40" className="absolute left-1/2 top-0 w-10 -translate-x-1/2 -translate-y-1/3 drop-shadow-md" aria-hidden>
        <path d="M20 38 L6 8 Q20 0 34 8 Z" fill="var(--color-coringa-gold)" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
