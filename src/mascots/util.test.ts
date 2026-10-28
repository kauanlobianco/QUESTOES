import { describe, expect, it } from 'vitest'
import { neutral } from './util'

describe('neutral', () => {
  it('zera cada transformação mantendo a mesma lista de funções (para interpolar de volta)', () => {
    expect(neutral('translate(0.8px,-1.1px) rotate(6deg)')).toBe('translate(0px,0px) rotate(0deg)')
    expect(neutral('rotate(-14deg) scale(1,-1.08)')).toBe('rotate(0deg) scale(1,1)')
    expect(neutral('skewX(-3deg) scale(1.02)')).toBe('skewX(0deg) scale(1)')
  })
})
