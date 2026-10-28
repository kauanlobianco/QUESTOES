// Relógio do servidor: os prazos das perguntas vêm em hora do servidor.
let offsetMs = 0

export function serverNow(): number {
  return Date.now() + offsetMs
}

/** Ajusta a diferença usando o meio da ida e volta da requisição. */
export function syncClock(serverTime: number, sentAt: number, receivedAt: number) {
  offsetMs = Math.round(serverTime - (sentAt + receivedAt) / 2)
}
