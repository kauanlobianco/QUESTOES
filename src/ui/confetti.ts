import confetti from 'canvas-confetti'

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function burst(colors: string[] = ['#fbbf24', '#ffffff']) {
  if (reduced()) return
  confetti({ particleCount: 90, spread: 75, startVelocity: 42, origin: { y: 0.55 }, colors, disableForReducedMotion: true })
}

export function celebrate() {
  if (reduced()) return
  const end = Date.now() + 1600
  const colors = ['#8b5cf6', '#ec4899', '#16a34a', '#2563eb', '#f97316', '#eab308']
  const frame = () => {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors })
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}
