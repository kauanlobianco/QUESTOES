// Sem 0/O, 1/I/L: fácil de ditar e digitar.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function newInviteCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}
