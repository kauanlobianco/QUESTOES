/** Utilidades compartilhadas pelo motor e pelas fichas de personalidade dos mascotes. */

export const SVG_NS = 'http://www.w3.org/2000/svg'

export const REDUCE_MOTION =
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Curvas de easing usadas em todas as animações. */
export const E = {
  out: 'cubic-bezier(.22,1,.36,1)',
  in: 'cubic-bezier(.55,0,1,.45)',
  inOut: 'cubic-bezier(.65,0,.35,1)',
  sine: 'cubic-bezier(.37,0,.63,1)',
  back: 'cubic-bezier(.34,1.56,.64,1)',
  outQuad: 'cubic-bezier(.25,.46,.45,.94)',
  inQuad: 'cubic-bezier(.55,.085,.68,.53)',
} as const

export const rand = (a: number, b: number) => a + Math.random() * (b - a)
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** translate em unidades do viewBox, com transformações extras opcionais. */
export const T = (x: number, y: number, extra?: string) => `translate(${x}px,${y}px)` + (extra ? ' ' + extra : '')

/** "translate(2px,3px) rotate(10deg) scale(1.1)" → "translate(0px,0px) rotate(0deg) scale(1)" */
export function neutral(t: string): string {
  return t.replace(/([a-zA-Z]+)\(([^)]*)\)/g, (_m, fn: string, args: string) => {
    const n = args.split(',').length
    const v = fn.startsWith('scale') ? '1' : fn.startsWith('rotate') || fn.startsWith('skew') ? '0deg' : '0px'
    return `${fn}(${Array(n).fill(v).join(',')})`
  })
}

export function svgEl(tag: string, attrs: Record<string, string | number>, parent?: Element): SVGElement {
  const n = document.createElementNS(SVG_NS, tag)
  for (const k in attrs) n.setAttribute(k, String(attrs[k]))
  if (parent) parent.appendChild(n)
  return n
}
