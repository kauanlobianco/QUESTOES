import type { Area } from '../engine'
import type { Mascot, Token } from './mascot'
import { E, T, pick, rand } from './util'

/**
 * Personalidade de cada mascote: ritmo de respiração, pivôs auxiliares, manias e reações próprias.
 * Todas as funções rodam com `this` = instância do Mascot (pontos em coordenadas do viewBox 0–80).
 */

export interface ArmDef {
  /** Braço apoiado na cintura: comemora espelhando no ombro em vez de girar. */
  cheer?: boolean
  /** Rotação (graus) ao comemorar. */
  up?: number
  /** Rotação (graus) mantida quando erra. */
  down?: number
}

type Hook = (this: Mascot, tk: Token) => void | Promise<void>

export interface CharDef {
  nome: string
  cor: string
  /** Altura aproximada (para girar em torno do centro no pulo com giro). */
  height: number
  jumpH: number
  /** Ciclo completo da respiração (ms). */
  breathe: number
  breatheAmt: number
  /** Balanço dos braços no repouso (graus). */
  sway: number
  arms: { l: ArmDef; r: ArmDef }
  /** Topo da cabeça, ponto da gota de suor e do balão de pensamento. */
  head: [number, number]
  sweat: [number, number]
  bubble: [number, number]
  palette: string[]
  waveArm?: 'l' | 'r'
  idle?: (this: Mascot) => void
  fidgets: Record<string, (this: Mascot, tk: Token) => Promise<void>>
  happy?: Hook
  sad?: Hook
  think?: Hook
}

export const CHARACTERS: Record<Area, CharDef> = {
  /* ---------------- FINANÇAS: banqueiro calmo, vaidoso, obcecado pela moeda ---------------- */
  financas: {
    nome: 'Finanças', cor: '#57BE56',
    height: 34, jumpH: 7, breathe: 1900, breatheAmt: .022, sway: 3,
    arms: { l: { cheer: true, down: -10 }, r: { up: -12, down: 0 } },
    head: [40, 22], sweat: [47.8, 26], bubble: [27, 24],
    palette: ['#57BE56', '#A6E89F', '#F9D847', '#F2BA25', '#D2F9D0'],
    idle() {
      this.loop('coin', [{ transform: T(0, 0) }, { transform: T(0, -0.9) }], { duration: 1300, direction: 'alternate', easing: E.sine })
    },
    fidgets: {
      async coinFlip(tk) {
        this.act('arm-r', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(8deg)', offset: .3 }, { transform: 'rotate(-10deg)', offset: .45 }, { transform: 'rotate(0deg)' }], { duration: 520, easing: E.inOut })
        if (!await this.sleep(180, tk)) return
        this.face({ mouth: 'o', brows: 'up', look: [1, -1.1] })
        this.act('coin', [
          { transform: T(0, 0), easing: E.outQuad },
          { transform: T(0, -15), offset: .48, easing: E.inQuad },
          { transform: T(0, 0), offset: .92 },
          { transform: T(0, 0) }], { duration: 1000 })
        this.act('coin-spin', [1, -1, 1, -1, 1, -1, 1, -1, 1].map((s) => ({ transform: `scale(${s},1)` })), { duration: 920, easing: 'linear' })
        if (!await this.sleep(420, tk)) return
        this.look(1, -1.4)
        if (!await this.sleep(420, tk)) return
        this.look(1, -0.2)
        if (!await this.sleep(150, tk)) return
        this.act('arm-r', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(7deg)', offset: .35 }, { transform: 'rotate(0deg)' }], { duration: 360, easing: E.out })
        this.squish(.08)
        this.sparkle(53, 31, { s: 1.6 })
        this.face({ eyes: 'happy', mouth: 'idle', brows: 'up' })
        await this.sleep(700, tk)
      },
      async coinSpin(tk) {
        this.face({ brows: 'up', look: [1, 0.2] })
        this.act('coin-spin', [1, -1, 1, -1, 1, -1, 1].map((s) => ({ transform: `scale(${s},1)` })), { duration: 1300, easing: E.inOut })
        this.act('coin', [{ transform: T(0, 0) }, { transform: T(0, -2.2), offset: .5 }, { transform: T(0, 0) }], { duration: 1300, easing: E.sine })
        if (!await this.sleep(1300, tk)) return
        this.face({ eyes: 'happy', look: [0.3, 0] })
        await this.sleep(600, tk)
      },
      async tie(tk) {
        this.face({ brows: 'up', look: [0, -0.5] })
        this.pose('upper', 'scale(1.035,1.035)', { duration: 260, easing: E.back })
        this.act('tie', [0, 14, -11, 8, -4, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 900, easing: E.inOut })
        if (!await this.sleep(900, tk)) return
        this.face({ eyes: 'happy', mouth: 'idle', brows: 'up' })
        this.sparkle(40, 40, { s: 1.4 })
        await this.sleep(650, tk)
      },
    },
    happy() {
      this.act('coin', [
        { transform: T(0, 0), easing: E.outQuad },
        { transform: T(0, -19), offset: .5, easing: E.inQuad },
        { transform: T(0, 0), offset: .95 },
        { transform: T(0, 0) }], { duration: 1150 })
      this.act('coin-spin', [1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1].map((s) => ({ transform: `scale(${s},1)` })), { duration: 1100, easing: 'linear' })
      for (let i = 0; i < 5; i++) {
        this.floatUp(53 + rand(-3, 3), 32, 'coin', { s: rand(1.1, 1.5), rise: rand(14, 20), dx: rand(-7, 7), delay: 120 + i * 110 })
      }
    },
    async sad(tk) {
      this.face({ mouth: 'o', brows: 'up', look: [1, -0.2] })
      this.holdAct('coin', [
        { transform: T(0, 0), easing: E.inQuad },
        { transform: T(1.5, 21.3), offset: .55, easing: E.outQuad },
        { transform: T(2.3, 18.6), offset: .7, easing: E.inQuad },
        { transform: T(3, 21.3), offset: .85 },
        { transform: T(3, 21.3) }], { duration: 800 })
      this.act('coin-spin', [1, -1, 1, -1, 1, -.5, 1].map((s) => ({ transform: `scale(${s},1)` })), { duration: 800, easing: 'linear' })
      if (!await this.sleep(500, tk)) return
      this.face({ mouth: 'sad', brows: 'sad', look: [1, 1.1] })
    },
    think() {
      this.stateLoop('look', [{ transform: T(-0.7, -0.35) }, { transform: T(0.7, -0.35) }], { duration: 650, direction: 'alternate', easing: E.inOut })
      this.stateLoop('coin-spin', [1, -1, 1].map((s) => ({ transform: `scale(${s},1)` })), { duration: 1500, easing: 'linear' })
    },
  },

  /* ---------------- ESTRATÉGIA: o alvo — focado, calculista, mira em tudo ---------------- */
  estrategia: {
    nome: 'Estratégia', cor: '#F2BC03',
    height: 22, jumpH: 7, breathe: 1800, breatheAmt: .02, sway: 3,
    arms: { l: { cheer: true, down: -6 }, r: { up: -45, down: 18 } },
    head: [40.2, 24.5], sweat: [51.5, 29], bubble: [27, 20],
    palette: ['#F2BC03', '#FCFCFC', '#F22438', '#8A5230', '#FFE45C'],
    idle() {
      this.loop('quiver-arrows', [{ transform: 'rotate(-1.5deg)' }, { transform: 'rotate(2deg)' }], { duration: 1800, direction: 'alternate', easing: E.sine, delay: -300 })
      this.loop('bow', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-2.5deg)' }], { duration: 1800, direction: 'alternate', easing: E.sine, delay: -600 })
    },
    fidgets: {
      async aim(tk) {
        this.pose('arm-r', 'rotate(-38deg)', { duration: 420, easing: E.back })
        this.pose('eye-l', 'scale(1,.25)', { duration: 200 })
        this.face({ brows: 'focus', look: [1.1, -0.4] })
        if (!await this.sleep(450, tk)) return
        this.act('bow', [0, 1, -1, 1, -1, .6, -.6, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 800 })
        if (!await this.sleep(850, tk)) return
        this.shootArrow(57.3, 45.3, 0)
        this.act('bow', [0, -9, 5, -2, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 420, easing: E.out })
        this.squish(.06)
        if (!await this.sleep(320, tk)) return
        this.release(380)
        this.face({ eyes: 'happy', mouth: 'idle', brows: 'up', look: [1, 0] })
        await this.sleep(700, tk)
      },
      async quiver(tk) {
        this.face({ brows: 'up', look: [-1.2, -0.3] })
        this.act('upper', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-3deg)', offset: .3 }, { transform: 'rotate(-3deg)', offset: .7 }, { transform: 'rotate(0deg)' }], { duration: 1300, easing: E.inOut })
        this.act('quiver', [0, -7, 6, -4, 3, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 700, delay: 250 })
        this.act('quiver-arrows', [0, 8, -6, 4, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 650, delay: 320 })
        if (!await this.sleep(1300, tk)) return
        this.face({ eyes: 'happy', look: [0, 0] })
        await this.sleep(500, tk)
      },
      async wobble(tk) {
        this.face({ mouth: 'o', brows: 'up', look: [1, -1.2] })
        this.act('arrow', [0, 6, -5, 4, -3, 2, -1, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 900, easing: E.inOut })
        this.act('rings', [{ transform: 'scale(1)' }, { transform: 'scale(1.05)', offset: .2 }, { transform: 'scale(1)' }], { duration: 400 })
        if (!await this.sleep(950, tk)) return
        this.face({ eyes: 'happy', look: [0, 0] })
        await this.sleep(500, tk)
      },
    },
    happy() {
      // A flecha sai e crava de novo no alvo
      this.act('arrow', [
        { transform: T(22, -22, 'rotate(0deg)'), easing: E.in },
        { transform: T(0, 0, 'rotate(0deg)'), offset: .22 },
        { transform: T(0, 0, 'rotate(8deg)'), offset: .34 },
        { transform: T(0, 0, 'rotate(-6deg)'), offset: .46 },
        { transform: T(0, 0, 'rotate(4deg)'), offset: .58 },
        { transform: T(0, 0, 'rotate(-2deg)'), offset: .7 },
        { transform: T(0, 0, 'rotate(0deg)') }], { duration: 950 })
      this.act('rings', [{ transform: 'scale(1)' }, { transform: 'scale(1)', offset: .2 }, { transform: 'scale(1.1)', offset: .3 }, { transform: 'scale(1)' }], { duration: 700 })
      this.ripple(45.5, 30.6, { r: 2, to: 4, color: '#FFFFFF', delay: 200 })
      this.ripple(40.2, 38, { r: 6, to: 2.2, color: '#FFE45C', delay: 260 })
      this.sparkle(46, 29.5, { s: 2, delay: 210 })
    },
    sad() {
      this.holdAct('arrow', [
        { transform: 'rotate(0deg)', easing: E.in },
        { transform: 'rotate(50deg)', offset: .5, easing: E.out },
        { transform: 'rotate(36deg)', offset: .7 },
        { transform: 'rotate(43deg)', offset: .85 },
        { transform: 'rotate(40deg)' }], { duration: 900, delay: 250 })
      this.pose('quiver', 'rotate(8deg)', { duration: 600, delay: 200 })
    },
    think() {
      this.pose('arm-r', 'rotate(-30deg)', { duration: 500, easing: E.back })
      this.pose('eye-l', 'scale(1,.3)', { duration: 220 })
      this.face({ brows: 'focus', look: [1, -0.5] })
      this.stateLoop('bow', [0, .8, -.8, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 300, composite: 'add' })
    },
  },

  /* ---------------- LIDERANÇA: o rei-herói — confiante, teatral, capa ao vento ---------------- */
  lideranca: {
    nome: 'Liderança', cor: '#FC951F',
    height: 30, jumpH: 6, breathe: 2300, breatheAmt: .016, sway: 2,
    arms: { l: { cheer: true, down: -6 }, r: { up: -12, down: 75 } },
    head: [41, 5], sweat: [53.5, 26], bubble: [22, 14],
    palette: ['#FC951F', '#F9D819', '#E65420', '#FFF1B8', '#BC3F14'],
    idle() {
      this.loop('cape-back', [{ transform: 'rotate(-1.5deg) scale(1,1)' }, { transform: 'rotate(2.5deg) scale(1.03,.98)' }], { duration: 1150, direction: 'alternate', easing: E.sine, key: 'capeBack' })
      this.loop('cape-front', [{ transform: 'rotate(-1deg) skewX(0deg)' }, { transform: 'rotate(2deg) skewX(-3deg)' }], { duration: 1150, direction: 'alternate', easing: E.sine, delay: -380, key: 'capeFront' })
      this.loop('.m-medal-shine', [{ opacity: .2, offset: 0 }, { opacity: 1, offset: .1 }, { opacity: .2, offset: .2 }, { opacity: .2, offset: 1 }], { duration: 2600 })
    },
    fidgets: {
      async heroPose(tk) {
        this.face({ brows: 'up', look: [0.7, -0.6] })
        this.pose('upper', 'scale(1.04,1.04)', { duration: 320, easing: E.back })
        this.act('arm-r', [0, -10, 0, -10, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 900, easing: E.inOut, delay: 200 })
        this.act('cape-back', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(7deg)', offset: .35 }, { transform: 'rotate(0deg)' }], { duration: 1100, easing: E.inOut })
        this.act('cape-front', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(6deg)', offset: .4 }, { transform: 'rotate(0deg)' }], { duration: 1100, easing: E.inOut })
        this.sparkle(71, 20.2, { s: 2.2, delay: 300 })
        this.sparkle(43.6, 43.5, { s: 1.6, delay: 600 })
        await this.sleep(1400, tk)
      },
      async crownShine(tk) {
        // a coroa é parte da torre: nada de soltar — só um brilho percorrendo a peça
        this.face({ brows: 'up', look: [0, -1.3] })
        this.pose('upper', 'rotate(-1.5deg) scale(1.02,1.02)', { duration: 380, easing: E.back })
        this.glint(700)
        if (!await this.sleep(650, tk)) return
        this.sparkle(50.6, 9.6, { s: 1.8 })
        this.face({ eyes: 'happy', look: [0, 0] })
        await this.sleep(700, tk)
      },
      async command(tk) {
        this.face({ brows: 'focus', look: [1, -0.4] })
        this.act('arm-r', [0, -18, 10, -6, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 1100, easing: E.inOut })
        this.act('root', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(2.5deg)', offset: .4 }, { transform: 'rotate(0deg)' }], { duration: 1100, easing: E.inOut })
        await this.chatter(900, tk)
        if (!tk.alive) return
        this.face({ brows: 'up' })
        await this.sleep(300, tk)
      },
    },
    happy() {
      this.glint(650, 250)
      this.act('arm-r', [0, -14, 0, -14, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 900, easing: E.inOut })
      this.act('cape-back', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(8deg)', offset: .35 }, { transform: 'rotate(0deg)' }], { duration: 1200, easing: E.inOut })
      for (let i = 0; i < 4; i++) this.sparkle(41 + rand(-9, 9), 12 + rand(-6, 4), { s: rand(1.6, 2.4), c: '#F9D819', delay: 200 + i * 120 })
    },
    sad() {
      this.pose('upper', 'rotate(-2.5deg)', { duration: 800, delay: 150, easing: E.inOut })
      this.pose('cape-back', 'rotate(-5deg)', { duration: 800 })
      this.pose('cape-front', 'rotate(-4deg)', { duration: 800 })
      this.rate('capeBack', .4); this.rate('capeFront', .4)
    },
    think() {
      this.pose('arm-r', 'rotate(32deg)', { duration: 600, easing: E.inOut })
      this.pose('upper', 'rotate(-2deg)', { duration: 600, easing: E.inOut })
      this.face({ brows: 'raise', look: [-0.8, -1] })
    },
  },

  /* ---------------- MARKETING: influencer — extrovertida, barulhenta, vive de likes ---------------- */
  marketing: {
    nome: 'Marketing', cor: '#FC3187',
    height: 30, jumpH: 8, breathe: 1250, breatheAmt: .028, sway: 4,
    arms: { l: { cheer: true, down: -8 }, r: { up: -22, down: 28 } },
    head: [38, 10], sweat: [51.5, 19], bubble: [60, 12],
    palette: ['#FC3187', '#FC80B7', '#FBF6F8', '#FF84BC', '#B81A60'],
    idle() {
      this.loop('ponytail', [{ transform: 'rotate(-3deg)' }, { transform: 'rotate(5deg)' }], { duration: 1250, direction: 'alternate', easing: E.sine, delay: -300, key: 'pony' })
      this.loop('heart', [
        { transform: 'scale(1)', offset: 0 }, { transform: 'scale(1.3)', offset: .12 }, { transform: 'scale(1)', offset: .24 },
        { transform: 'scale(1.2)', offset: .36 }, { transform: 'scale(1)', offset: .5 }, { transform: 'scale(1)', offset: 1 }], { duration: 1500 })
      this.loop('megaphone', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-2.5deg)' }], { duration: 1250, direction: 'alternate', easing: E.sine })
    },
    fidgets: {
      async shout(tk) {
        this.pose('arm-r', 'rotate(-14deg)', { duration: 300, easing: E.back })
        this.act('root', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(4deg)', offset: .2 }, { transform: 'rotate(4deg)', offset: .8 }, { transform: 'rotate(0deg)' }], { duration: 1500, easing: E.inOut })
        this.face({ brows: 'up', look: [1, -0.3] })
        this.waves(3)
        await this.chatter(1300, tk)
        if (!tk.alive) return
        this.face({ eyes: 'happy', mouth: 'idle' })
        await this.sleep(400, tk)
      },
      async hairFlip(tk) {
        this.face({ eyes: 'happy', brows: 'up', look: [-0.6, -0.4] })
        this.act('ponytail', [0, -28, 14, -7, 3, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 1000, easing: E.out })
        this.act('upper', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-4deg)', offset: .25 }, { transform: 'rotate(1.5deg)', offset: .6 }, { transform: 'rotate(0deg)' }], { duration: 1000, easing: E.inOut })
        this.sparkle(16, 12, { s: 1.6, delay: 250, c: '#FFFFFF' })
        await this.sleep(1150, tk)
      },
      async notify(tk) {
        this.act('notif', [
          { opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1.3)', offset: .12 },
          { opacity: 1, transform: 'scale(1)', offset: .2 }, { opacity: 1, transform: 'scale(1)', offset: .85 },
          { opacity: 0, transform: 'scale(.6)' }], { duration: 1900, easing: E.out, composite: 'replace' })
        this.face({ mouth: 'o', brows: 'up', look: [1, -1.2] })
        if (!await this.sleep(500, tk)) return
        this.face({ eyes: 'happy', mouth: 'happy', brows: 'up', look: [0.6, 0.6] })
        this.act('heart', [{ transform: 'scale(1)' }, { transform: 'scale(1.6)', offset: .3 }, { transform: 'scale(1)' }], { duration: 500, easing: E.back })
        this.floatUp(40.5, 51, 'heart', { s: 1.6, rise: 18, dx: 3, c: '#FF4F8B' })
        await this.sleep(1100, tk)
      },
    },
    happy() {
      this.waves(2)
      this.act('notif', [
        { opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1.3)', offset: .12 },
        { opacity: 1, transform: 'scale(1)', offset: .2 }, { opacity: 1, transform: 'scale(1)', offset: .85 },
        { opacity: 0, transform: 'scale(.6)' }], { duration: 1700, easing: E.out, composite: 'replace' })
      this.act('ponytail', [0, -20, 12, -5, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 1000, easing: E.out })
      const cols = ['#FF4F8B', '#FF84BC', '#FFFFFF', '#FC3187']
      for (let i = 0; i < 7; i++) {
        this.floatUp(39 + rand(-6, 6), 46, 'heart', { s: rand(1.3, 2), rise: rand(16, 26), dx: rand(-12, 12), c: pick(cols), delay: 100 + i * 90 })
      }
    },
    sad() {
      this.holdProp('.m-screen-dim', 'opacity', 0, .5, { duration: 600, delay: 150 })
      this.pose('ponytail', 'rotate(-14deg)', { duration: 700, easing: E.out })
      this.rate('pony', .4)
    },
    think() {
      this.pose('arm-r', 'rotate(12deg)', { duration: 500 })
      this.face({ brows: 'raise', look: [0.8, -1] })
      this.stateLoop('comment', [{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: .5 }, { transform: 'scale(1)' }], { duration: 700, easing: E.sine, composite: 'add' })
    },
  },

  /* ---------------- OPERAÇÕES: o engenheiro — metódico, confiável, checklist na mão ---------------- */
  operacoes: {
    nome: 'Operações', cor: '#306CC9',
    height: 32, jumpH: 6, breathe: 2400, breatheAmt: .014, sway: 2,
    arms: { l: { cheer: true, down: -6 }, r: { up: -28, down: 22 } },
    head: [34.6, 8], sweat: [44.6, 23], bubble: [16, 12],
    palette: ['#306CC9', '#F7D841', '#E5EBEF', '#4989E8', '#D8AB34'],
    idle() {
      this.loop('hat', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-1.2deg)' }], { duration: 2400, direction: 'alternate', easing: E.sine })
      this.loop('clipboard', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(1.5deg)' }], { duration: 2400, direction: 'alternate', easing: E.sine, delay: -600 })
    },
    fidgets: {
      async checklist(tk) {
        this.face({ brows: 'up', look: [1.1, 0.5] })
        this.pose('clipboard', 'rotate(-8deg)', { duration: 350 })
        await this.checks(420, tk, true)
        if (!tk.alive) return
        this.squish(.06)
        this.face({ eyes: 'happy', brows: 'up', look: [0.3, 0] })
        await this.sleep(700, tk)
      },
      async hatTap(tk) {
        this.face({ brows: 'up', look: [0, -1.2] })
        this.act('hat', [
          { transform: T(0, 0, 'rotate(0deg)'), easing: E.out },
          { transform: T(0, -3, 'rotate(-7deg)'), offset: .35, easing: E.in },
          { transform: T(0, 0, 'rotate(3deg)'), offset: .6 },
          { transform: T(0, 0, 'rotate(-1deg)'), offset: .8 },
          { transform: T(0, 0, 'rotate(0deg)') }], { duration: 900 })
        if (!await this.sleep(950, tk)) return
        this.face({ eyes: 'happy', look: [0, 0] })
        await this.sleep(500, tk)
      },
      async stretch(tk) {
        this.face({ mouth: 'o', brows: 'up', look: [0, -0.8] })
        this.pose('upper', 'scale(.97,1.07)', { duration: 600, easing: E.inOut })
        this.pose('arm-l', 'rotate(-6deg) scale(1,-1.05)', { duration: 600, easing: E.inOut })
        this.pose('eye-l', 'scale(1,.15)', { duration: 400 })
        this.pose('eye-r', 'scale(1,.15)', { duration: 400 })
        if (!await this.sleep(1100, tk)) return
        this.release(450)
        this.face({ eyes: 'happy', mouth: 'idle' })
        await this.sleep(500, tk)
      },
    },
    happy(tk) {
      this.checks(150, tk, false)
      this.act('hat', [
        { transform: T(0, 0, 'rotate(0deg)'), easing: E.out },
        { transform: T(0, -5, 'rotate(-14deg)'), offset: .35, easing: E.in },
        { transform: T(0, 0, 'rotate(4deg)'), offset: .65 },
        { transform: T(0, 0, 'rotate(0deg)') }], { duration: 850, delay: 120 })
    },
    sad() {
      // capacete fica na cabeça: só tomba de lado, apoiado na aba direita
      this.act('hat', [{ transform: 'scale(1,1)' }, { transform: 'scale(1.06,.9)', offset: .4 }, { transform: 'scale(1,1)' }], { duration: 260, delay: 60 })
      this.pose('hat', T(0.8, -1.1, 'rotate(6deg)'), { duration: 650, delay: 300, easing: E.back })
      this.pose('clipboard', 'rotate(22deg)', { duration: 700, delay: 150 })
    },
    think() {
      this.pose('clipboard', 'rotate(-12deg)', { duration: 450 })
      this.face({ brows: 'raise', look: [1.1, 0.5] })
      this.stateLoop('.m-line-2', [{ opacity: 1 }, { opacity: .2 }], { duration: 450, direction: 'alternate' })
    },
  },

  /* ---------------- EMPREENDEDORISMO: o visionário — elétrico, ideia sempre acesa ---------------- */
  empreendedorismo: {
    nome: 'Empreendedorismo', cor: '#B16BE3',
    height: 36, jumpH: 9, breathe: 1250, breatheAmt: .026, sway: 4,
    arms: { l: { cheer: true, down: -8 }, r: { up: -14, down: 72 } },
    head: [33, 3], sweat: [45.8, 20], bubble: [12, 9],
    palette: ['#B16BE3', '#FCE04C', '#6A20A5', '#FFF1B8', '#D0A6F2'],
    idle() {
      this.loop('bulb', [{ transform: T(0, 0) }, { transform: T(0, -1.1) }], { duration: 1500, direction: 'alternate', easing: E.sine })
      this.loop('.m-bulb-glow', [{ opacity: .18 }, { opacity: .42 }], { duration: 1500, direction: 'alternate', easing: E.sine })
      this.loop('hair', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-2.5deg)' }], { duration: 1250, direction: 'alternate', easing: E.sine, delay: -250, key: 'hair' })
      this.loop('hair-back', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-3deg)' }], { duration: 1250, direction: 'alternate', easing: E.sine, delay: -350 })
    },
    fidgets: {
      async eureka(tk) {
        this.face({ mouth: 'o', brows: 'up', look: [1, -1.3] })
        if (!await this.sleep(350, tk)) return
        this.bulbOn(1300)
        this.act('hand-r', [0, -12, 0, -8, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 700, easing: E.inOut })
        this.jump({ h: 4, dur: 520 })
        this.face({ eyes: 'happy', mouth: 'happy', brows: 'up' })
        await this.sleep(1300, tk)
      },
      async flicker(tk) {
        this.face({ brows: 'sad', look: [1, -1.3] })
        this.act('.m-bulb-dim', [0, .8, .1, .8, 0, .7, .7, 0].map((o) => ({ opacity: o })), { duration: 1200, easing: 'steps(1,end)', composite: 'replace' })
        if (!await this.sleep(1250, tk)) return
        this.bulbOn(700)
        this.face({ eyes: 'happy', brows: 'up' })
        await this.sleep(750, tk)
      },
      async hairSwoosh(tk) {
        this.face({ eyes: 'happy', brows: 'up', look: [-0.4, -0.3] })
        this.act('hair', [0, -9, 5, -2, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 850, easing: E.out })
        this.act('hair-back', [0, -12, 6, -2, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: 850, easing: E.out, delay: 60 })
        this.act('upper', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-3deg)', offset: .3 }, { transform: 'rotate(1deg)', offset: .65 }, { transform: 'rotate(0deg)' }], { duration: 900, easing: E.inOut })
        this.sparkle(38, 4, { s: 1.6, delay: 200, c: '#FFFFFF' })
        await this.sleep(1000, tk)
      },
      async rocket(tk) {
        this.face({ mouth: 'o', brows: 'up', look: [0, 1.2] })
        this.act('rocket', [
          { transform: T(0, 0, 'rotate(0deg)') }, { transform: T(.4, -.5, 'rotate(-6deg)'), offset: .2 },
          { transform: T(-.3, -.2, 'rotate(5deg)'), offset: .4 }, { transform: T(.5, -.8, 'rotate(-4deg)'), offset: .6 },
          { transform: T(0, 0, 'rotate(0deg)') }], { duration: 900 })
        this.act('.m-rocket-flame', [1, 1.6, 1, 1.7, 1, 1.5, 1].map((s) => ({ transform: `scale(${s})` })), { duration: 900 })
        if (!await this.sleep(950, tk)) return
        this.face({ eyes: 'happy', mouth: 'happy', look: [0, 0] })
        await this.sleep(600, tk)
      },
    },
    happy() {
      this.bulbOn(1500)
      this.act('rocket', [{ transform: T(0, 0) }, { transform: T(.5, -.7), offset: .3 }, { transform: T(0, 0) }], { duration: 500, iterations: 2 })
    },
    sad() {
      this.holdProp('.m-bulb-dim', 'opacity', 0, .72, { duration: 500, delay: 150 })
      this.holdProp('.m-bulb-glow', 'opacity', .25, 0, { duration: 400 })
      this.pose('bulb', T(0, 2.2, 'rotate(16deg)'), { duration: 700, delay: 150, easing: E.back })
      this.pose('hair', 'scale(1,.92)', { duration: 600 })
    },
    think() {
      this.face({ brows: 'raise', look: [1, -1.3] })
      this.stateLoop('.m-bulb-dim', [0, .75, 0, 0, .6, 0, .7, 0, 0, 0].map((o) => ({ opacity: o })), { duration: 1700, easing: 'steps(1,end)' })
    },
  },
}
