import type { Area } from '../engine'
import { CHARACTERS, type CharDef } from './characters'
import { E, REDUCE_MOTION, T, clamp, neutral, pick, rand, svgEl } from './util'

/*
 * Motor de animação dos mascotes (Web Animations API, sem dependências).
 *
 * Partes rigadas nos SVGs (classes m-*): root, body, legs, leg-l/r, upper, arm-l/r,
 * torso, face, brows, brow-l/r, look, eyes, eye-l/r, eyes-happy, mouth(-idle/-happy/-sad/-o), fx
 * + adereços de cada personagem (coin, bow, crown, cape, megaphone, hat, bulb...).
 *
 * Camadas: loops de repouso (substituem) + movimentos pontuais e poses (composite: 'add').
 */

export type MascotState = 'idle' | 'enter' | 'wave' | 'think' | 'happy' | 'sad' | 'celebrate' | 'talk' | 'dizzy' | 'tap'

export interface MascotOptions {
  /** Enquadra o personagem num viewBox quadrado justo (true = folga de 20%). */
  fit?: boolean | number
  /** Olhar segue o ponteiro no repouso. */
  followPointer?: boolean
  /** Toque = cutucada; 6 toques rápidos = tontura. */
  interactive?: boolean
  /** Manias automáticas a cada 5–9 s. */
  fidgets?: boolean
}

export interface PlayOptions {
  /** Mantém a pose final (ex.: triste até a próxima pergunta). */
  hold?: boolean
  /** Duração da fala (talk). */
  duration?: number
}

export interface Token {
  alive: boolean
}

type Target = string | Element
type Face = { eyes?: 'normal' | 'happy'; mouth?: 'idle' | 'happy' | 'sad' | 'o'; brows?: BrowName; look?: [number, number] }
type BrowName = keyof typeof BROWS
type Pose = { node: Element; a: Animation } & ({ prop?: undefined; to: string } | { prop: string; from: number; to: number })
type ShapeName = keyof typeof SHAPE
type ParticleOpts = { s?: number; c?: string; delay?: number; dur?: number }

/* ---------- Formas dos efeitos (desenhadas em torno de 0,0, ~1 unidade) ---------- */
const PATH = {
  star: 'M0-1C.12-.3.3-.12 1 0 .3.12.12.3 0 1-.12.3-.3.12-1 0-.3-.12-.12-.3 0-1Z',
  heart: 'M0 .9C-.25.7-1.2.1-1.2-.4-1.2-.85-.85-1.1-.5-1.1-.25-1.1-.08-.95 0-.8.08-.95.25-1.1.5-1.1.85-1.1 1.2-.85 1.2-.4 1.2.1.25.7 0 .9Z',
  drop: 'M0-1.3C.55-.55.95-.05.95.4A.95.95 0 0 1-.95.4C-.95-.05-.55-.55 0-1.3Z',
}
const SHAPE = {
  star: (g: Element, c?: string) => svgEl('path', { d: PATH.star, fill: c || '#FFE45C' }, g),
  heart: (g: Element, c?: string) => svgEl('path', { d: PATH.heart, fill: c || '#FF4F8B' }, g),
  coin: (g: Element) => {
    svgEl('circle', { r: 1, fill: '#F9D847' }, g)
    svgEl('circle', { r: 0.8, fill: '#F2BA25' }, g)
    svgEl('path', { d: 'M.28-.32C.16-.48-.32-.5-.32-.24S.3.02.3.26-.2.5-.32.32M0-.62V.62', stroke: '#C68A11', 'stroke-width': 0.16, 'stroke-linecap': 'round' }, g)
  },
  drop: (g: Element) => {
    svgEl('path', { d: PATH.drop, fill: '#8FD8FF' }, g)
    svgEl('ellipse', { cx: -0.32, cy: 0.3, rx: 0.17, ry: 0.3, fill: '#fff', opacity: 0.85 }, g)
  },
  confetti: (g: Element, c?: string) => svgEl('rect', { x: -0.9, y: -0.5, width: 1.8, height: 1, rx: 0.2, fill: c ?? '#FFE45C' }, g),
}

type BrowPose = [number, number, number]
const BROWS: Record<string, [BrowPose, BrowPose]> = {
  neutral: [[0, 0, 0], [0, 0, 0]],
  up: [[0, -0.8, 0], [0, -0.8, 0]],
  sad: [[0, -0.4, -16], [0, -0.4, 16]],
  focus: [[0, 0.45, 12], [0, 0.45, -12]],
  raise: [[0, 0, 0], [0, -1.1, -8]],
}

/** Estados que ficam até outro começar. */
const HOLD_STATES: Partial<Record<MascotState, true>> = { think: true }

export class Mascot {
  readonly svg: SVGSVGElement
  readonly id: Area
  readonly def: CharDef
  readonly opts: Required<Omit<MascotOptions, 'fit'>> & Pick<MascotOptions, 'fit'>
  state: MascotState = 'idle'
  lookLock = false
  /** Escala dos efeitos, proporcional ao tamanho do personagem. */
  readonly k: number

  private visible = true
  private token: Token = { alive: true }
  private loops: Animation[] = []
  private loopKeys: Record<string, Animation> = {}
  private stateLoops: Animation[] = []
  private actions: Animation[] = []
  private poses: Pose[] = []
  private stateFx: Element[] = []
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private browCur: [BrowPose, BrowPose] = BROWS.neutral!
  private browAnims: (Animation | null)[] = []
  private taps: number[] = []
  private cache = new Map<string, Element | null>()
  private fxLayer: Element
  private onTap?: (e: PointerEvent) => void
  private onMove?: (e: PointerEvent) => void
  private io?: IntersectionObserver

  constructor(svg: SVGSVGElement, opts: MascotOptions = {}) {
    this.svg = svg
    this.id = svg.getAttribute('data-character') as Area
    this.def = CHARACTERS[this.id]
    this.opts = { followPointer: true, interactive: true, fidgets: true, ...opts }

    svg.classList.add('mascot')
    this.fxLayer = this.q('fx') ?? svgEl('g', { class: 'm-fx' }, svg)
    const rb = this.bodyBox()
    this.k = rb && rb.width ? clamp(Math.max(rb.width, rb.height) / 40, 0.9, 1.9) : 1
    if (this.opts.fit) this.fit(this.opts.fit === true ? 1.2 : this.opts.fit)
    this.face({})
    this.startIdle()
    this.bind()
  }

  /* ---------- enquadramento ---------- */

  /** Caixa do personagem sem as partes que começam invisíveis (ondas, raios, brilho, notificação). */
  private bodyBox(): DOMRect | null {
    const root = this.q('root') as SVGGraphicsElement | null
    if (!root?.getBBox) return null
    const hidden = [...this.svg.querySelectorAll<SVGElement>('.m-waves, .m-bulb-rays, .m-bulb-glow, .m-notif, .m-crown-glint')]
    hidden.forEach((n) => (n.style.display = 'none'))
    const b = root.getBBox()
    hidden.forEach((n) => (n.style.display = ''))
    return b
  }

  /** viewBox quadrado justo com os pés perto da base: cada desenho ocupa uma área diferente do 80×80 original. */
  fit(pad: number) {
    const b = this.bodyBox()
    if (!b || !b.width) return
    const size = Math.max(b.width, b.height) * pad
    const x = b.x + b.width / 2 - size / 2
    const y = b.y + b.height + size * 0.07 - size
    this.svg.setAttribute('viewBox', `${x.toFixed(2)} ${y.toFixed(2)} ${size.toFixed(2)} ${size.toFixed(2)}`)
  }

  /* ---------- utilidades ---------- */

  q(name: Target): Element | null {
    if (name instanceof Element) return name
    if (!this.cache.has(name)) this.cache.set(name, this.svg.querySelector(name.startsWith('.') ? name : '.m-' + name))
    return this.cache.get(name) ?? null
  }

  private after(ms: number, fn: () => void) {
    const id = setTimeout(() => {
      this.timers.delete(id)
      fn()
    }, ms)
    this.timers.add(id)
  }

  /** Espera; resolve false se outro estado começou nesse meio-tempo. */
  sleep(ms: number, tk?: Token): Promise<boolean> {
    return new Promise((res) => this.after(ms, () => res(!tk || tk.alive)))
  }

  private newToken() {
    this.token.alive = false
    this.token = { alive: true }
    return this.token
  }

  private skip(kf: Keyframe[]) {
    return REDUCE_MOTION && kf.some((k) => 'transform' in k)
  }

  /** Loop de repouso (substitui). `key` permite mudar a velocidade depois. */
  loop(target: Target, kf: Keyframe[], o: KeyframeAnimationOptions & { key?: string } = {}) {
    const { key, ...opts } = o
    const node = this.q(target)
    if (!node || this.skip(kf)) return null
    const a = node.animate(kf, { iterations: Infinity, ...opts })
    this.loops.push(a)
    if (key) this.loopKeys[key] = a
    return a
  }

  /** Loop que só vale durante o estado atual. */
  stateLoop(target: Target, kf: Keyframe[], o: KeyframeAnimationOptions = {}) {
    const node = this.q(target)
    if (!node || this.skip(kf)) return null
    const a = node.animate(kf, { iterations: Infinity, ...o })
    this.stateLoops.push(a)
    return a
  }

  /** Movimento pontual, somado ao repouso. */
  act(target: Target, kf: Keyframe[], o: KeyframeAnimationOptions = {}) {
    const node = this.q(target)
    if (!node || this.skip(kf)) return null
    const a = node.animate(kf, { composite: 'add', fill: 'none', ...o })
    this.actions.push(a)
    const drop = () => {
      const i = this.actions.indexOf(a)
      if (i >= 0) this.actions.splice(i, 1)
    }
    a.finished.then(drop, drop)
    return a
  }

  /** Pose mantida até release(). */
  pose(target: Target, to: string, o: KeyframeAnimationOptions = {}) {
    return this.holdAct(target, [{ transform: neutral(to) }, { transform: to }], o)
  }

  holdAct(target: Target, kf: Keyframe[], o: KeyframeAnimationOptions = {}) {
    const node = this.q(target)
    if (!node || this.skip(kf)) return null
    const a = node.animate(kf, { duration: 300, easing: E.out, fill: 'forwards', composite: 'add', ...o })
    a.persist()
    this.poses.push({ node, to: String(kf[kf.length - 1]!.transform), a })
    return a
  }

  holdProp(target: Target, prop: string, from: number, to: number, o: KeyframeAnimationOptions = {}) {
    const node = this.q(target)
    if (!node) return null
    const a = node.animate([{ [prop]: from }, { [prop]: to }], { duration: 300, easing: E.out, fill: 'forwards', ...o })
    a.persist()
    this.poses.push({ node, prop, from, to, a })
    return a
  }

  /** Solta uma pose específica sem transição. */
  unhold(a: Animation | null | undefined) {
    if (!a) return
    this.poses = this.poses.filter((p) => p.a !== a)
    a.cancel()
  }

  /** Solta todas as poses voltando suavemente ao repouso. */
  release(dur = 380) {
    const poses = this.poses
    this.poses = []
    for (const p of poses) {
      p.a.cancel()
      if (p.prop !== undefined) {
        p.node.animate([{ [p.prop]: p.to }, { [p.prop]: p.from }], { duration: dur, easing: E.inOut })
      } else if (!REDUCE_MOTION) {
        p.node.animate([{ transform: p.to }, { transform: neutral(p.to) }], { duration: dur, easing: E.inOut, composite: 'add' })
      }
    }
  }

  rate(key: string, r: number) {
    this.loopKeys[key]?.updatePlaybackRate(r)
  }

  /* ---------- rosto ---------- */

  face(f: Face) {
    this.svg.dataset.eyes = f.eyes ?? 'normal'
    this.svg.dataset.mouth = f.mouth ?? 'idle'
    this.brows(f.brows ?? 'neutral')
    if (f.look) this.look(f.look[0], f.look[1])
  }

  brows(name: BrowName) {
    const next = BROWS[name] ?? BROWS.neutral!
    this.svg.dataset.brows = name
    const prev = this.browCur
    const old = this.browAnims
    const f = (b: BrowPose) => `translate(${b[0]}px,${b[1]}px) rotate(${b[2]}deg)`
    this.browAnims = (['brow-l', 'brow-r'] as const).map((side, i) => {
      const node = this.q(side)
      if (!node) return null
      const a = node.animate([{ transform: f(prev[i]!) }, { transform: f(next[i]!) }], { duration: REDUCE_MOTION ? 0 : 220, easing: E.out, fill: 'forwards' })
      a.persist()
      return a
    })
    old.forEach((a) => a?.cancel())
    this.browCur = next
  }

  look(dx = 0, dy = 0) {
    dx = clamp(dx, -1.5, 1.5)
    dy = clamp(dy, -1.5, 1.5)
    const face = this.q('face') as SVGElement | null
    const look = this.q('look') as SVGElement | null
    if (face) face.style.transform = `translate(${dx * 0.55}px,${dy * 0.5}px)`
    if (look) look.style.transform = `translate(${dx * 0.55}px,${dy * 0.45}px)`
  }

  /** Olha para um elemento da página (ex.: a alternativa sob o dedo) ou um ponto da tela. */
  lookAt(target: Element | { x: number; y: number }) {
    const r = this.svg.getBoundingClientRect()
    let x: number, y: number
    if (target instanceof Element) {
      const t = target.getBoundingClientRect()
      x = t.left + t.width / 2
      y = t.top + t.height / 2
    } else {
      ;({ x, y } = target)
    }
    const cx = r.left + r.width / 2
    const cy = r.top + r.height * 0.4
    const dx = (x - cx) / Math.max(r.width, 1)
    const dy = (y - cy) / Math.max(r.height, 1)
    this.look(clamp(dx * 2.4, -1, 1) * 1.2, clamp(dy * 2.4, -1, 1))
  }

  blink(double = false) {
    if (this.svg.dataset.eyes === 'happy') return
    const kf = [{ transform: 'scale(1,1)' }, { transform: 'scale(1,.08)', offset: 0.45 }, { transform: 'scale(1,1)' }]
    for (const e of ['eye-l', 'eye-r']) {
      this.q(e)?.animate(kf, { duration: 150, iterations: double ? 2 : 1, easing: 'ease-in-out', composite: 'add' })
    }
  }

  /* ---------- blocos de movimento ---------- */

  jump(o: { h?: number; dur?: number; squash?: number; spin?: number; delay?: number } = {}) {
    const h = o.h ?? this.def.jumpH
    const dur = o.dur ?? 620
    const sq = o.squash ?? 0.16
    const spin = o.spin ?? 0
    const delay = o.delay ?? 0
    const c = -this.def.height / 2
    // Giro em torno do centro do corpo (a origem fica nos pés).
    const rot = (deg: number) => (spin ? ` translate(0px,${c}px) rotate(${deg}deg) translate(0px,${-c}px)` : '')
    this.act('body', [
      { transform: 'scale(1,1)', offset: 0 },
      { transform: `scale(${1 + sq},${1 - sq})`, offset: 0.2, easing: E.out },
      { transform: `scale(${1 - sq * 0.6},${1 + sq * 0.8})`, offset: 0.34, easing: E.out },
      { transform: 'scale(1,1)', offset: 0.55 },
      { transform: 'scale(1,1)', offset: 0.76, easing: E.out },
      { transform: `scale(${1 + sq * 0.9},${1 - sq * 0.9})`, offset: 0.84, easing: E.out },
      { transform: 'scale(.97,1.03)', offset: 0.93 },
      { transform: 'scale(1,1)', offset: 1 },
    ], { duration: dur, delay })
    this.act('root', [
      { transform: T(0, 0) + rot(0), offset: 0 },
      { transform: T(0, 0) + rot(0), offset: 0.24, easing: E.outQuad },
      { transform: T(0, -h) + rot(spin / 2), offset: 0.52, easing: E.inQuad },
      { transform: T(0, 0) + rot(spin), offset: 0.78 },
      { transform: T(0, 0) + rot(spin), offset: 1 },
    ], { duration: dur, delay })
    this.act('shadow', [
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(1.1)', offset: 0.22 },
      { transform: 'scale(.55)', offset: 0.52 },
      { transform: 'scale(1.1)', offset: 0.8 },
      { transform: 'scale(1)', offset: 1 },
    ], { duration: dur, delay, composite: 'replace' })
    const kick = (deg: number) => [
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(0deg)', offset: 0.3 },
      { transform: `rotate(${deg}deg)`, offset: 0.52 },
      { transform: 'rotate(0deg)', offset: 0.76 },
      { transform: 'rotate(0deg)' },
    ]
    this.act('leg-l', kick(16), { duration: dur, delay })
    this.act('leg-r', kick(-16), { duration: dur, delay })
  }

  squish(s = 0.14) {
    this.act('body', [
      { transform: 'scale(1,1)' },
      { transform: `scale(${1 + s},${1 - s})`, offset: 0.25 },
      { transform: `scale(${1 - s * 0.55},${1 + s * 0.55})`, offset: 0.5 },
      { transform: `scale(${1 + s * 0.2},${1 - s * 0.2})`, offset: 0.75 },
      { transform: 'scale(1,1)' },
    ], { duration: 520, easing: E.out })
  }

  shake(a = 1.4) {
    this.act('root', [0, -a, a, -a * 0.7, a * 0.5, -a * 0.25, 0].map((x) => ({ transform: T(x, 0) })), { duration: 420, easing: E.inOut })
  }

  armsUp(o: { dur?: number; delay?: number } = {}) {
    const dur = o.dur ?? 1000
    ;(['l', 'r'] as const).forEach((s, i) => {
      const a = this.def.arms[s]
      let kf: Keyframe[]
      if (a.cheer) {
        // Braço na cintura vira braço erguido: espelha no ombro (passar por "escala 0" lê como balanço em perspectiva).
        kf = [
          { transform: 'rotate(0deg) scale(1,1)' },
          { transform: 'rotate(-14deg) scale(1,-1.08)', offset: 0.25, easing: E.inOut },
          { transform: 'rotate(-4deg) scale(1,-.96)', offset: 0.45 },
          { transform: 'rotate(-12deg) scale(1,-1.04)', offset: 0.65 },
          { transform: 'rotate(0deg) scale(1,1)' },
        ]
      } else if (a.up) {
        kf = [
          { transform: 'rotate(0deg)' },
          { transform: `rotate(${a.up}deg)`, offset: 0.25, easing: E.inOut },
          { transform: `rotate(${a.up * 0.75}deg)`, offset: 0.45 },
          { transform: `rotate(${a.up}deg)`, offset: 0.65 },
          { transform: 'rotate(0deg)' },
        ]
      } else return
      this.act('arm-' + s, kf, { duration: dur, easing: E.out, delay: (o.delay ?? 0) + i * 60 })
    })
  }

  armsDown() {
    for (const s of ['l', 'r'] as const) {
      const d = this.def.arms[s].down
      if (d) this.pose('arm-' + s, `rotate(${d}deg)`, { duration: 650, easing: E.inOut, delay: 120 })
    }
  }

  /** Boca abrindo e fechando por `ms`. */
  async chatter(ms: number, tk: Token) {
    const shapes = ['o', 'happy', 'idle', 'o', 'happy', 'o']
    const end = performance.now() + ms
    const eyes = this.svg.dataset.eyes
    let i = 0
    while (performance.now() < end) {
      this.svg.dataset.mouth = shapes[i++ % shapes.length]
      this.act('mouth', [{ transform: 'scale(1,1)' }, { transform: 'scale(1.08,.8)', offset: 0.5 }, { transform: 'scale(1,1)' }], { duration: 140 })
      if (!(await this.sleep(rand(95, 160), tk))) return
    }
    this.svg.dataset.mouth = 'idle'
    this.svg.dataset.eyes = eyes
  }

  /** Ondas sonoras do megafone (Marketing). */
  waves(cycles = 2) {
    this.svg.querySelectorAll('.m-wave').forEach((w, i) => {
      this.act(w, [
        { opacity: 0, transform: 'scale(.7)' },
        { opacity: 1, transform: 'scale(1.05)', offset: 0.45 },
        { opacity: 0, transform: 'scale(1.25)' },
      ], { duration: 520, delay: i * 120, iterations: cycles, composite: 'replace', easing: E.out })
    })
  }

  /** Checklist da prancheta (Operações): apaga e redesenha linha a linha. */
  async checks(step: number, tk: Token, nod: boolean) {
    const rows = [1, 2, 3]
    const erased: Record<string, Animation | null> = {}
    for (const r of rows) {
      for (const s of ['.m-check-' + r, '.m-line-' + r]) erased[s] = this.holdProp(s, 'strokeDashoffset', 0, 1, { duration: 140 })
    }
    if (!(await this.sleep(220, tk))) return
    for (const r of rows) {
      const line = '.m-line-' + r
      const check = '.m-check-' + r
      this.unhold(erased[line])
      this.unhold(erased[check])
      this.act(line, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: step * 0.5, fill: 'backwards', composite: 'replace' })
      this.act(check, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: step * 0.45, delay: step * 0.4, fill: 'backwards', composite: 'replace', easing: E.out })
      if (nod) this.act('face', [{ transform: T(0, 0) }, { transform: T(0, 0.5), offset: 0.5 }, { transform: T(0, 0) }], { duration: step * 0.9 })
      if (!(await this.sleep(step * 0.85, tk))) return
      this.sparkle(49 - (r - 1) * 0.8, 38.6 + (r - 1) * 2.6, { s: 1.1, c: '#FFFFFF' })
    }
  }

  /** Lâmpada acende com brilho e raios (Empreendedorismo). */
  bulbOn(dur = 1300) {
    this.act('.m-bulb-glow', [{ opacity: 0.3 }, { opacity: 1, offset: 0.12 }, { opacity: 0.9, offset: 0.8 }, { opacity: 0.3 }], { duration: dur, composite: 'replace' })
    this.act('.m-bulb-glow', [{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.15 }, { transform: 'scale(1.15)', offset: 0.8 }, { transform: 'scale(1)' }], { duration: dur })
    this.act('.m-bulb-rays', [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: dur, composite: 'replace' })
    this.act('.m-bulb-rays', [{ transform: 'rotate(0deg) scale(.8)' }, { transform: 'rotate(50deg) scale(1.1)' }], { duration: dur, easing: E.out })
    this.act('bulb', [1, 1.28, 0.94, 1.06, 1].map((s) => ({ transform: `scale(${s})` })), { duration: 600, easing: E.out })
    this.sparkle(55.8 + rand(-6, 6), 15 + rand(-6, 2), { s: 1.6, delay: 150 })
    this.sparkle(55.8 + rand(-6, 6), 15 + rand(-6, 2), { s: 1.3, delay: 350 })
  }

  /** Brilho que percorre a coroa (Liderança): a coroa é parte da torre e nunca sai do corpo. */
  glint(dur = 700, delay = 0) {
    this.act('.m-crown-glint', [{ transform: T(0, 0) }, { transform: T(36, 0) }], { duration: dur, delay, easing: E.inOut })
  }

  /* ---------- efeitos (partículas no viewBox) ---------- */

  private particle(build: (g: Element) => void, kf: Keyframe[], o: KeyframeAnimationOptions) {
    if (REDUCE_MOTION) return null
    const g = svgEl('g', { class: 'm-particle' }, this.fxLayer)
    g.style.transformOrigin = '0px 0px'
    build(g)
    const a = g.animate(kf, { duration: 800, easing: 'linear', fill: 'both', ...o })
    const rm = () => g.remove()
    a.finished.then(rm, rm)
    return a
  }

  sparkle(x: number, y: number, o: ParticleOpts = {}) {
    const s = (o.s ?? 1.8) * this.k
    return this.particle((g) => SHAPE.star(g, o.c), [
      { transform: T(x, y, 'scale(0) rotate(0deg)') },
      { transform: T(x, y, `scale(${s}) rotate(45deg)`), offset: 0.4, easing: E.in },
      { transform: T(x, y, 'scale(0) rotate(90deg)') },
    ], { duration: o.dur ?? 650, delay: o.delay ?? 0, easing: E.out })
  }

  sparkles(n: number, around: [number, number], radius: number, o: ParticleOpts = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2)
      const r = rand(radius * 0.6, radius) * this.k
      this.sparkle(around[0] + Math.cos(a) * r, around[1] + Math.sin(a) * r * 0.7, { s: rand(1.3, 2.2), delay: i * 110, ...o })
    }
  }

  floatUp(x: number, y: number, shape: ShapeName, o: ParticleOpts & { rise?: number; dx?: number } = {}) {
    const k = this.k
    const s = (o.s ?? 1.5) * k
    const rise = (o.rise ?? 16) * k
    const dx = (o.dx ?? 0) * k
    return this.particle((g) => SHAPE[shape](g, o.c), [
      { transform: T(x, y, 'scale(0) rotate(0deg)'), opacity: 1 },
      { transform: T(x + dx * 0.3, y - rise * 0.3, `scale(${s}) rotate(-12deg)`), offset: 0.22, opacity: 1 },
      { transform: T(x + dx * 0.7, y - rise * 0.7, `scale(${s * 0.9}) rotate(10deg)`), offset: 0.65, opacity: 1 },
      { transform: T(x + dx, y - rise, `scale(${s * 0.7}) rotate(-6deg)`), opacity: 0 },
    ], { duration: o.dur ?? 1300, delay: o.delay ?? 0, easing: E.outQuad })
  }

  confetti(x: number, y: number, n: number, colors = this.def.palette) {
    const ks = this.k
    for (let i = 0; i < n; i++) {
      const ang = (rand(-165, -15) * Math.PI) / 180
      const sp = rand(18, 32) * ks
      const g = 48 * ks
      const vx = Math.cos(ang) * sp
      const vy = Math.sin(ang) * sp
      const spin = rand(300, 900) * (Math.random() < 0.5 ? -1 : 1)
      const tt = rand(1.1, 1.6)
      const kf: Keyframe[] = []
      for (let step = 0; step <= 6; step++) {
        const t = (step / 6) * tt
        kf.push({
          transform: T(x + vx * t, y + vy * t + 0.5 * g * t * t, `rotate(${spin * t}deg) scale(${(1.5 * ks).toFixed(2)},${(Math.cos(t * 9) * 1.4 * ks).toFixed(2)})`),
          opacity: step === 6 ? 0 : 1,
        })
      }
      this.particle((gg) => SHAPE.confetti(gg, pick(colors)), kf, { duration: tt * 1000, delay: rand(0, 120) })
    }
  }

  ripple(x: number, y: number, o: { r?: number; to?: number; color?: string; delay?: number; dur?: number } = {}) {
    return this.particle((g) => svgEl('circle', { r: (o.r ?? 3) * this.k, stroke: o.color ?? '#fff', 'stroke-width': 0.5 * this.k, fill: 'none' }, g), [
      { transform: T(x, y, 'scale(.4)'), opacity: 0.95 },
      { transform: T(x, y, `scale(${o.to ?? 3})`), opacity: 0 },
    ], { duration: o.dur ?? 600, delay: o.delay ?? 0, easing: E.out })
  }

  sweat(o: { delay?: number } = {}) {
    const [x, y] = this.def.sweat
    return this.particle((g) => SHAPE.drop(g), [
      { transform: T(x, y, 'scale(0)'), opacity: 1 },
      { transform: T(x, y, `scale(${1.4 * this.k})`), offset: 0.2, opacity: 1, easing: E.inQuad },
      { transform: T(x + 0.4, y + 5 * this.k, `scale(${1.1 * this.k})`), opacity: 0 },
    ], { duration: 1200, delay: o.delay ?? 0 })
  }

  shootArrow(x: number, y: number, angle: number) {
    const rad = (angle * Math.PI) / 180
    return this.particle((g) => {
      svgEl('path', { d: 'M-5 0H3', stroke: '#7A462A', 'stroke-width': 0.5, 'stroke-linecap': 'round' }, g)
      svgEl('path', { d: 'M3.6 0 2.6-.6V.6Z', fill: '#5B3520' }, g)
      svgEl('path', { d: 'M-5 0-6.2-.9H-4.6L-3.8 0-4.6.9H-6.2Z', fill: '#F22438' }, g)
    }, [
      { transform: T(x, y, `rotate(${angle}deg)`), opacity: 1 },
      { transform: T(x + 40 * Math.cos(rad), y + 40 * Math.sin(rad), `rotate(${angle}deg)`), opacity: 0 },
    ], { duration: 380, easing: E.in })
  }

  /** Balão de pensamento que fica até o estado mudar. */
  bubble(text = '?') {
    if (REDUCE_MOTION) return
    const [x, y] = this.def.bubble
    const g = svgEl('g', { class: 'm-particle m-bubble' }, this.fxLayer)
    const dx = x < 40 ? 1 : -1
    svgEl('circle', { cx: x + dx * 3.6, cy: y + 5.8, r: 0.7, fill: '#fff' }, g)
    svgEl('circle', { cx: x + dx * 2, cy: y + 3.8, r: 1.1, fill: '#fff' }, g)
    svgEl('circle', { cx: x, cy: y, r: 4.2, fill: '#fff' }, g)
    const t = svgEl('text', { x, y: y + 0.2, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#4A3A8C', class: 'm-bubble-text' }, g)
    t.textContent = text
    t.style.transformOrigin = `${x}px ${y}px`
    g.style.transformOrigin = `${x}px ${y}px`
    const k = this.k
    g.animate([
      { transform: 'scale(0)', opacity: 0 },
      { transform: `scale(${1.12 * k})`, opacity: 1, offset: 0.7 },
      { transform: `scale(${k})`, opacity: 1 },
    ], { duration: 380, easing: E.out, fill: 'both', delay: 200 })
    t.animate([0, -12, 10, -6, 0, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 1400, iterations: Infinity, delay: 600 })
    this.stateFx.push(g)
  }

  dizzyStars() {
    const [hx, hy] = this.def.head
    const ks = this.k
    for (let i = 0; i < 3; i++) {
      const kf: Keyframe[] = []
      for (let step = 0; step <= 8; step++) {
        const a = (step / 8) * Math.PI * 2 + i * ((Math.PI * 2) / 3)
        kf.push({ transform: T(hx + Math.cos(a) * 7 * ks, hy + 3 * ks + Math.sin(a) * 1.8 * ks, `scale(${(1.4 + Math.sin(a) * 0.4) * ks})`) })
      }
      this.particle((g) => SHAPE.star(g, '#FFE45C'), kf, { duration: 750, iterations: 3 })
    }
  }

  /* ---------- estados ---------- */

  private clearState() {
    this.release(380)
    this.actions.slice().forEach((a) => a.cancel())
    this.actions = []
    this.stateLoops.forEach((a) => a.cancel())
    this.stateLoops = []
    for (const g of this.stateFx) {
      const a = g.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.6)' }], { duration: 200, fill: 'forwards' })
      a.finished.then(() => g.remove(), () => g.remove())
      setTimeout(() => g.remove(), 400)
    }
    this.stateFx = []
    this.loops.forEach((a) => a.updatePlaybackRate(1))
    this.lookLock = false
    this.face({ look: [0, 0] })
  }

  /** Toca um estado; resolve quando a reação termina. */
  async play(name: MascotState, o: PlayOptions = {}) {
    if (name === 'idle') return this.idle()
    const tk = this.newToken()
    this.clearState()
    this.state = name
    this.svg.dataset.state = name
    await STATES[name].call(this, tk, o)
    if (tk.alive && !HOLD_STATES[name] && !o.hold) this.idle()
  }

  idle() {
    this.newToken()
    this.clearState()
    this.state = 'idle'
    this.svg.dataset.state = 'idle'
  }

  /** Mania da personalidade (aleatória se sem nome). */
  async fidget(name?: string) {
    const f = this.def.fidgets
    const fn = f[name ?? pick([...Object.keys(f), 'lookAround'])] ?? lookAround
    const tk = this.newToken()
    this.clearState()
    this.state = 'idle'
    this.lookLock = true
    await fn.call(this, tk)
    if (tk.alive) {
      this.release(420)
      this.face({ look: [0, 0] })
      this.lookLock = false
    }
  }

  private startIdle() {
    const d = this.def
    const half = d.breathe / 2
    // Respira esticando a partir do quadril: o tronco nunca desgruda das pernas.
    this.loop('upper', [
      { transform: 'translate(0px,0px) scale(1,1)' },
      { transform: `translate(0px,0px) scale(${1 - d.breatheAmt * 0.45},${1 + d.breatheAmt})` },
    ], { duration: half, direction: 'alternate', easing: E.sine, key: 'breath' })
    this.loop('shadow', [{ transform: 'scale(1)' }, { transform: 'scale(.96)' }], { duration: half, direction: 'alternate', easing: E.sine })
    this.loop('arm-l', [{ transform: 'rotate(0deg)' }, { transform: `rotate(${d.sway * 0.6}deg)` }], { duration: half, direction: 'alternate', easing: E.sine, delay: -d.breathe * 0.15 })
    this.loop('arm-r', [{ transform: 'rotate(0deg)' }, { transform: `rotate(${-d.sway * 0.5}deg)` }], { duration: half, direction: 'alternate', easing: E.sine, delay: -d.breathe * 0.3 })
    d.idle?.call(this)
    this.blinkLoop()
    if (this.opts.fidgets) this.fidgetLoop()
  }

  private blinkLoop() {
    this.after(rand(1800, 4800), () => {
      if (this.visible) this.blink(Math.random() < 0.2)
      this.blinkLoop()
    })
  }

  private fidgetLoop() {
    this.after(rand(5200, 9500), () => {
      if (this.visible && this.state === 'idle' && !this.lookLock && !REDUCE_MOTION) void this.fidget()
      this.fidgetLoop()
    })
  }

  private bind() {
    if (this.opts.interactive) {
      this.svg.classList.add('is-interactive')
      this.onTap = (e) => {
        e.preventDefault()
        this.tap()
      }
      this.svg.addEventListener('pointerdown', this.onTap)
    }
    if (this.opts.followPointer) {
      let raf = 0
      let last = { x: 0, y: 0 }
      let idleT: ReturnType<typeof setTimeout> | undefined
      this.onMove = (e) => {
        last = { x: e.clientX, y: e.clientY }
        if (raf) return
        raf = requestAnimationFrame(() => {
          raf = 0
          if (this.state !== 'idle' || this.lookLock || !this.visible) return
          this.lookAt(last)
          clearTimeout(idleT)
          idleT = setTimeout(() => {
            if (this.state === 'idle' && !this.lookLock) this.look(0, 0)
          }, 2600)
        })
      }
      window.addEventListener('pointermove', this.onMove, { passive: true })
    }
    if ('IntersectionObserver' in window) {
      // Fora da tela, pausa só os loops infinitos (reações pontuais seguem normalmente).
      this.io = new IntersectionObserver((entries) => {
        this.visible = entries[0]?.isIntersecting ?? true
        for (const a of [...this.loops, ...this.stateLoops]) {
          if (!this.visible && a.playState === 'running') a.pause()
          else if (this.visible && a.playState === 'paused') a.play()
        }
      })
      this.io.observe(this.svg)
    }
  }

  private tap() {
    const now = performance.now()
    this.taps = this.taps.filter((t) => now - t < 2500)
    this.taps.push(now)
    if (this.taps.length >= 6) {
      this.taps = []
      void this.play('dizzy')
    } else if (this.state === 'idle') void this.play('tap')
    else this.squish(0.1)
  }

  destroy() {
    this.newToken()
    this.timers.forEach(clearTimeout)
    this.timers.clear()
    this.svg.getAnimations({ subtree: true }).forEach((a) => a.cancel())
    if (this.onTap) this.svg.removeEventListener('pointerdown', this.onTap)
    if (this.onMove) window.removeEventListener('pointermove', this.onMove)
    this.io?.disconnect()
  }
}

/* ================================================================
 * Estados genéricos (+ ganchos de cada personagem)
 * ================================================================ */

type StateFn = (this: Mascot, tk: Token, o: PlayOptions) => Promise<void>

async function lookAround(this: Mascot, tk: Token) {
  this.look(-1.1, 0)
  if (!(await this.sleep(650, tk))) return
  this.blink()
  this.look(1.1, -0.4)
  if (!(await this.sleep(750, tk))) return
  this.look(0, 0)
  await this.sleep(300, tk)
}

async function wave(this: Mascot, tk: Token) {
  this.face({ eyes: 'happy', mouth: 'happy', brows: 'up', look: [0, 0] })
  const w = (r: number, extra: Partial<Keyframe> = {}): Keyframe => ({ transform: `rotate(${r}deg) scale(1,-1)`, ...extra })
  this.act('arm-l', [
    { transform: 'rotate(0deg) scale(1,1)' },
    w(-8, { offset: 0.2, easing: E.inOut }),
    w(-26, { offset: 0.35 }),
    w(4, { offset: 0.5 }),
    w(-26, { offset: 0.65 }),
    w(-8, { offset: 0.8 }),
    { transform: 'rotate(0deg) scale(1,1)' },
  ], { duration: 1400, easing: E.inOut })
  this.act('upper', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(2deg)', offset: 0.3 }, { transform: 'rotate(2deg)', offset: 0.7 }, { transform: 'rotate(0deg)' }], { duration: 1400, easing: E.inOut })
  await this.sleep(1450, tk)
}

const STATES: Record<Exclude<MascotState, 'idle'>, StateFn> = {
  async happy(tk) {
    const d = this.def
    this.face({ eyes: 'happy', mouth: 'happy', brows: 'up' })
    this.jump()
    this.armsUp()
    void d.happy?.call(this, tk)
    this.sparkles(3, d.head, 9)
    if (!(await this.sleep(680, tk))) return
    this.jump({ h: d.jumpH * 0.45, dur: 440, squash: 0.1 })
    await this.sleep(900, tk)
  },

  async sad(tk, o) {
    const d = this.def
    this.shake(1.2)
    this.squish(0.1)
    this.face({ mouth: 'sad', brows: 'sad', look: [0, 0.9] })
    this.pose('upper', 'translate(0px,.6px) scale(1.02,.95)', { duration: 700, easing: E.inOut, delay: 120 })
    this.armsDown()
    this.rate('breath', 0.55)
    this.sweat({ delay: 350 })
    void d.sad?.call(this, tk)
    if (!(await this.sleep(1300, tk))) return
    this.sweat()
    if (o.hold) return
    await this.sleep(1500, tk)
  },

  async think(tk) {
    this.face({ brows: 'raise', look: [0.9, -1] })
    this.stateLoop('root', [{ transform: 'rotate(-1.8deg)' }, { transform: 'rotate(1.8deg)' }], { duration: 1500, direction: 'alternate', easing: E.sine, composite: 'add' })
    this.bubble('?')
    void this.def.think?.call(this, tk)
  },

  async celebrate(tk) {
    const d = this.def
    this.face({ eyes: 'happy', mouth: 'happy', brows: 'up' })
    this.jump({ h: d.jumpH * 1.7, dur: 950, spin: 360, squash: 0.2 })
    this.armsUp({ dur: 1600 })
    void d.happy?.call(this, tk)
    if (!(await this.sleep(380, tk))) return
    this.confetti(d.head[0], d.head[1] + 4, 34)
    this.sparkles(5, d.head, 12)
    if (!(await this.sleep(700, tk))) return
    this.jump({ h: d.jumpH * 0.5, dur: 440, squash: 0.1 })
    if (!(await this.sleep(460, tk))) return
    this.jump({ h: d.jumpH * 0.35, dur: 400, squash: 0.08 })
    await this.sleep(900, tk)
  },

  async enter(tk) {
    this.face({ mouth: 'o', brows: 'up', look: [0, 0.8] })
    this.act('root', [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1 }], { duration: 700, composite: 'replace' })
    this.act('root', [{ transform: T(0, -36), easing: E.inQuad }, { transform: T(0, 0), offset: 0.62 }, { transform: T(0, 0) }], { duration: 700 })
    this.act('body', [
      { transform: 'scale(.88,1.14)' },
      { transform: 'scale(.88,1.14)', offset: 0.58 },
      { transform: 'scale(1.22,.78)', offset: 0.68, easing: E.out },
      { transform: 'scale(.95,1.05)', offset: 0.84 },
      { transform: 'scale(1,1)' },
    ], { duration: 900 })
    this.act('shadow', [{ transform: 'scale(0)' }, { transform: 'scale(1.15)', offset: 0.62 }, { transform: 'scale(1)' }], { duration: 900, composite: 'replace' })
    if (!(await this.sleep(470, tk))) return
    const sh = this.q('shadow')
    if (sh) this.ripple(Number(sh.getAttribute('cx')), Number(sh.getAttribute('cy')), { r: 4, to: 2.6, color: this.def.cor })
    if (!(await this.sleep(300, tk))) return
    await wave.call(this, tk)
  },

  wave,

  async talk(tk, o) {
    const ms = o.duration ?? 2200
    this.face({ brows: 'up' })
    this.stateLoop('upper', [{ transform: 'rotate(-1.2deg)' }, { transform: 'rotate(1.2deg)' }], { duration: 380, direction: 'alternate', easing: E.sine, composite: 'add' })
    if (this.id === 'marketing') this.waves(Math.ceil(ms / 600))
    await this.chatter(ms, tk)
  },

  async tap(tk) {
    this.squish(0.16)
    this.blink()
    const r = Math.random()
    if (r < 0.35) {
      this.face({ eyes: 'happy', mouth: 'happy', brows: 'up' })
      if (!(await this.sleep(160, tk))) return
      this.jump({ h: 3, dur: 380, squash: 0.08 })
      if (!(await this.sleep(400, tk))) return
      this.jump({ h: 2, dur: 340, squash: 0.06 })
      await this.sleep(500, tk)
    } else if (r < 0.65) {
      this.face({ mouth: 'o', brows: 'up' })
      this.act('upper', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-5deg)', offset: 0.3 }, { transform: 'rotate(3deg)', offset: 0.6 }, { transform: 'rotate(0deg)' }], { duration: 600, easing: E.out })
      await this.sleep(700, tk)
    } else {
      if (!(await this.sleep(220, tk))) return
      const fidgets = Object.values(this.def.fidgets)
      if (fidgets.length) {
        this.lookLock = true
        await pick(fidgets).call(this, tk)
      }
    }
  },

  async dizzy(tk) {
    this.face({ mouth: 'sad', brows: 'sad' })
    this.pose('eye-l', 'scale(1,.25)', { duration: 150 })
    this.pose('eye-r', 'scale(1,.25)', { duration: 150 })
    this.act('root', [0, -7, 6, -5, 4, -3, 2, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 1800, easing: E.inOut })
    this.stateLoop('look', [0, 1, 2, 3, 4].map((k) => ({ transform: T(Math.cos((k * Math.PI) / 2) * 0.8, Math.sin((k * Math.PI) / 2) * 0.5) })), { duration: 600 })
    this.dizzyStars()
    await this.sleep(2100, tk)
  },
}
