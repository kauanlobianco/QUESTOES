import { AREAS, type Area } from '../src/engine'
import { MAX_NAME_LENGTH, type ApiRequest, type ClientCommand } from '../src/game/protocol'
import { ApiError } from './service'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CODE = /^[A-Za-z0-9]{6}$/

type Json = Record<string, unknown>

const bad = (msg: string): never => {
  throw new ApiError('BAD_REQUEST', msg)
}

const isObject = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x)

export function cleanName(x: unknown): string {
  if (typeof x !== 'string') return bad('nome ausente')
  // Remove caracteres de controle e espaços repetidos.
  const name = x.replace(/[\p{C}]/gu, '').replace(/\s+/g, ' ').trim()
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) return bad(`nome deve ter de 1 a ${MAX_NAME_LENGTH} caracteres`)
  return name
}

function matchId(x: unknown): string {
  return typeof x === 'string' && UUID.test(x) ? x.toLowerCase() : bad('matchId inválido')
}

function code(x: unknown): string {
  return typeof x === 'string' && CODE.test(x) ? x.toUpperCase() : bad('código inválido')
}

function area(x: unknown): Area {
  return AREAS.includes(x as Area) ? (x as Area) : bad('área inválida')
}

function command(x: unknown): ClientCommand {
  if (!isObject(x)) return bad('comando ausente')
  switch (x.type) {
    case 'SPIN':
    case 'DUEL_NEXT':
    case 'RESIGN':
      return { type: x.type }
    case 'ANSWER':
      if (x.option !== null && !Number.isInteger(x.option)) return bad('alternativa inválida')
      return { type: 'ANSWER', option: x.option as number | null }
    case 'CHOOSE_CROWN':
      return { type: 'CHOOSE_CROWN', area: area(x.area) }
    case 'START_DUEL':
      return { type: 'START_DUEL', requested: area(x.requested), offered: area(x.offered) }
    default:
      return bad('comando desconhecido')
  }
}

export function parseApiRequest(x: unknown): ApiRequest {
  if (!isObject(x)) return bad('corpo deve ser um objeto JSON')
  switch (x.op) {
    case 'create':
      return { op: 'create', name: cleanName(x.name) }
    case 'peek':
      return { op: 'peek', code: code(x.code) }
    case 'join':
      return { op: 'join', code: code(x.code), name: cleanName(x.name) }
    case 'get':
      return { op: 'get', matchId: matchId(x.matchId) }
    case 'command':
      return { op: 'command', matchId: matchId(x.matchId), command: command(x.command) }
    default:
      return bad('op desconhecida')
  }
}
