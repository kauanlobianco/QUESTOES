import { SLICES } from '../engine'
import { AREA_INFO } from '../content/areas'

const SEG = 360 / SLICES.length

function slice(i: number) {
  const p = (deg: number) => `${(40 * Math.sin((deg * Math.PI) / 180)).toFixed(2)} ${(-40 * Math.cos((deg * Math.PI) / 180)).toFixed(2)}`
  return `M0 0 L${p(i * SEG - SEG / 2)} A40 40 0 0 1 ${p(i * SEG + SEG / 2)} Z`
}

/** Mini roleta girando: estado de carregamento do jogo. */
export function Loading({ text = 'Carregando…' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center gap-4" role="status">
      <svg viewBox="-42 -42 84 84" className="size-16 animate-spin [animation-duration:1.4s]" aria-hidden>
        {SLICES.map((s, i) => (
          <path key={s} d={slice(i)} fill={s === 'coringa' ? 'var(--color-coringa-deep)' : AREA_INFO[s].color} stroke="#fff" strokeWidth="1.5" />
        ))}
        <circle r="7" fill="var(--color-coringa-gold)" stroke="#fff" strokeWidth="2" />
      </svg>
      <p className="font-display text-lg text-white/80">{text}</p>
    </div>
  )
}

/** Tela inteira só com o carregamento. */
export function LoadingScreen({ text }: { text?: string }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <Loading text={text} />
    </main>
  )
}
