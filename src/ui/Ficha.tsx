import type { Area } from '../engine'
import { AREA_INFO } from '../content/areas'

interface FichaProps {
  area: Area
  owned?: boolean
  size?: number
  className?: string
}

/** Ficha redonda do personagem; apagada quando ainda não conquistada. */
export function Ficha({ area, owned = true, size = 32, className = '' }: FichaProps) {
  const info = AREA_INFO[area]
  return (
    <img
      src={info.ficha}
      alt={owned ? info.name : `${info.name} (não conquistado)`}
      width={size}
      height={size}
      className={`rounded-full transition ${owned ? 'shadow-md ring-2 ring-white' : 'opacity-25 grayscale'} ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
