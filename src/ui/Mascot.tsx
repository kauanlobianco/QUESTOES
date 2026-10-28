import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import type { Area } from '../engine'
import { loadMascotSvg } from '../mascots/load'
import { Mascot as MascotEngine, type MascotState } from '../mascots/mascot'
import '../mascots/mascots.css'

export type { MascotState }

export interface MascotHandle {
  play: (state: MascotState, opts?: { hold?: boolean; duration?: number }) => Promise<void>
  /** Olha para um elemento (ex.: alternativa sob o dedo); null volta a olhar para frente. */
  lookAt: (target: Element | null) => void
}

interface MascotProps {
  area: Area
  /** Lado do quadro em px; sem size, o tamanho vem do className. */
  size?: number
  className?: string
  /** Nome lido por leitores de tela; sem label o mascote é decorativo. */
  label?: string
  /** Animação de chegada, tocada uma vez quando o SVG carrega. */
  intro?: MascotState
  introDelay?: number
  /** Estado controlado: ao mudar, o mascote reage (sad fica até o próximo estado). */
  mood?: MascotState
  interactive?: boolean
  followPointer?: boolean
  fidgets?: boolean
  ref?: Ref<MascotHandle>
}

/** Mascote animado de uma área: respira, pisca, tem manias e reage aos estados do jogo. */
export function Mascot(props: MascotProps) {
  const { area, size, className = '', label, intro, introDelay = 0, mood, interactive = true, followPointer = true, fidgets = true, ref } = props
  const box = useRef<HTMLDivElement>(null)
  const engine = useRef<MascotEngine | null>(null)
  const [ready, setReady] = useState<MascotEngine | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    let alive = true
    let introTimer: ReturnType<typeof setTimeout> | undefined
    loadMascotSvg(area).then(
      (svg) => {
        if (!alive) return
        el.innerHTML = svg
        const m = new MascotEngine(el.querySelector('svg')!, { fit: true, interactive, followPointer, fidgets })
        engine.current = m
        if (intro) {
          // Esconde até a chegada começar, para não "piscar" parado antes de cair.
          if (introDelay > 0) el.style.opacity = '0'
          introTimer = setTimeout(() => {
            el.style.opacity = ''
            void m.play(intro)
          }, introDelay)
        }
        setReady(m)
      },
      () => {},
    )
    return () => {
      alive = false
      clearTimeout(introTimer)
      engine.current?.destroy()
      engine.current = null
      setReady(null)
      el.innerHTML = ''
      el.style.opacity = ''
    }
    // intro/introDelay só valem na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, interactive, followPointer, fidgets])

  useEffect(() => {
    if (!ready || !mood) return
    if (mood === 'idle') {
      if (ready.state !== 'idle') ready.idle()
    } else {
      void ready.play(mood, { hold: mood === 'sad' })
    }
  }, [ready, mood])

  useImperativeHandle(
    ref,
    () => ({
      play: (state, opts) => engine.current?.play(state, opts) ?? Promise.resolve(),
      lookAt: (target) => {
        const m = engine.current
        if (!m) return
        if (target) {
          if (m.state !== 'idle' && m.state !== 'think') return
          m.lookLock = true
          m.lookAt(target)
        } else {
          m.lookLock = false
          if (m.state === 'idle') m.look(0, 0)
        }
      },
    }),
    [],
  )

  return (
    <div
      ref={box}
      className={`shrink-0 ${className}`}
      style={size ? { width: size, height: size } : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
