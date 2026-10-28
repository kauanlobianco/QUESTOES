// Sons e vibração do jogo. Os sons são sintetizados com Web Audio: nenhum
// arquivo para baixar. Uma chave só liga e desliga os dois (salva no navegador).
import { useSyncExternalStore } from 'react'

export type Sfx = 'tick' | 'land' | 'correct' | 'wrong' | 'urgent' | 'crown' | 'duel' | 'turn' | 'win' | 'lose'

const KEY = 'mdn:muted'
let muted = readMuted()
let ctx: AudioContext | null = null
const listeners = new Set<() => void>()

function readMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setMuted(value: boolean) {
  muted = value
  try {
    localStorage.setItem(KEY, value ? '1' : '0')
  } catch {
    // Ignora: modo privado.
  }
  listeners.forEach((fn) => fn())
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => muted,
  )
}

/** O navegador só libera áudio depois de um toque: chamar em todo pointerdown. */
export function unlockAudio() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

interface Note {
  /** Hz. */
  f: number
  /** Início e duração em segundos. */
  at: number
  dur: number
  type?: OscillatorType
  gain?: number
  /** Desliza até esta frequência. */
  to?: number
}

function tone(ac: AudioContext, out: AudioNode, n: Note) {
  const t = ac.currentTime + n.at
  const osc = ac.createOscillator()
  const env = ac.createGain()
  osc.type = n.type ?? 'triangle'
  osc.frequency.setValueAtTime(n.f, t)
  if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t + n.dur)
  const peak = n.gain ?? 0.25
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(peak, t + 0.01)
  env.gain.exponentialRampToValueAtTime(0.0001, t + n.dur)
  osc.connect(env).connect(out)
  osc.start(t)
  osc.stop(t + n.dur + 0.02)
}

const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5

const SOUNDS: Record<Sfx, Note[]> = {
  tick: [{ f: 1400, at: 0, dur: 0.025, type: 'square', gain: 0.05 }],
  land: [
    { f: G5, at: 0, dur: 0.12 },
    { f: C6, at: 0.08, dur: 0.2 },
  ],
  correct: [
    { f: C5, at: 0, dur: 0.12 },
    { f: E5, at: 0.08, dur: 0.12 },
    { f: G5, at: 0.16, dur: 0.28 },
  ],
  wrong: [{ f: 220, at: 0, dur: 0.32, type: 'sawtooth', gain: 0.12, to: 130 }],
  urgent: [{ f: 880, at: 0, dur: 0.06, type: 'sine', gain: 0.15 }],
  crown: [
    { f: C5, at: 0, dur: 0.14 },
    { f: E5, at: 0.12, dur: 0.14 },
    { f: G5, at: 0.24, dur: 0.14 },
    { f: C6, at: 0.36, dur: 0.5, gain: 0.3 },
  ],
  duel: [
    { f: G5, at: 0, dur: 0.12, type: 'square', gain: 0.08 },
    { f: G5, at: 0.14, dur: 0.12, type: 'square', gain: 0.08 },
    { f: C6, at: 0.28, dur: 0.4, type: 'square', gain: 0.1 },
  ],
  turn: [
    { f: G5, at: 0, dur: 0.15, type: 'sine', gain: 0.25 },
    { f: C6, at: 0.13, dur: 0.3, type: 'sine', gain: 0.25 },
  ],
  win: [
    { f: C5, at: 0, dur: 0.16 },
    { f: E5, at: 0.15, dur: 0.16 },
    { f: G5, at: 0.3, dur: 0.16 },
    { f: E5, at: 0.45, dur: 0.12 },
    { f: G5, at: 0.57, dur: 0.12 },
    { f: C6, at: 0.69, dur: 0.7, gain: 0.3 },
  ],
  lose: [
    { f: G5, at: 0, dur: 0.2, type: 'sine' },
    { f: E5, at: 0.2, dur: 0.2, type: 'sine' },
    { f: C5, at: 0.4, dur: 0.45, type: 'sine' },
  ],
}

export function play(name: Sfx) {
  if (muted || !ctx || ctx.state !== 'running') return
  const out = ctx.createGain()
  out.gain.value = 0.8
  out.connect(ctx.destination)
  for (const n of SOUNDS[name]) tone(ctx, out, n)
}

/** Vibra no celular. Ignorado sem toque prévio na página (regra do navegador) ou com o som desligado. */
export function vibrate(pattern: number | number[]) {
  if (muted || !navigator.userActivation?.hasBeenActive) return
  navigator.vibrate?.(pattern)
}
