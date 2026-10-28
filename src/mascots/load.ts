import type { Area } from '../engine'

// Cada SVG rigado vira um chunk próprio, baixado só quando o mascote aparece na tela.
const loaders = import.meta.glob<string>('./svg/*.svg', { query: '?raw', import: 'default' })
const cache = new Map<Area, Promise<string>>()

export function loadMascotSvg(area: Area): Promise<string> {
  let svg = cache.get(area)
  if (!svg) {
    const load = loaders[`./svg/${area}.svg`]
    if (!load) return Promise.reject(new Error(`Mascote não encontrado: ${area}`))
    svg = load()
    cache.set(area, svg)
  }
  return svg
}
